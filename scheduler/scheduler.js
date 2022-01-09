import HackOptimiser from "scheduler/hack_optimiser";
import Host from "scheduler/host.js";
import Job from "scheduler/job.js";
import Target from "scheduler/target.js";
import DeployedScripts from "util/deployed_scripts.js";
import Logger from "util/logger.js";

export default class {
  constructor(ns, messenger) {
    this.ns = ns;
    this.messenger = messenger
    this.ds = new DeployedScripts(ns);
    this.hackOptimiser = new HackOptimiser(ns, messenger)
    this.minimumRamOnHost = this.ds.weakenScriptRam + this.ds.growScriptRam;
    this.log = new Logger(ns, "Scheduler", false);

    this.workpoolHosts = []
    this.targetList = []

    this.targetHostname = ""
    this.targetObject = null
    this.log.info(`Scheduler started. WorkPool [${this.workpoolServers}] (min ram ${this.minimumRamOnHost}GB)`);
  }

  set workpoolServers(serverList) {
    this.workpoolHosts = serverList
      .map(s => s.hostname)
      .map(name => new Host(this.ns, name))
  }

  get workpoolServers() {
    return this.workpoolHosts
  }

  updateTargetList(list) {
    if (this.targetList.length < 1) {
      this.target = list[0].hostname
    }
    this.targetList = list
  }

  set target(hostname) {
    this.messenger.queue(`Scheduler Target set to ${hostname}`, "success");
    this.targetHostname = hostname;
    this.targetObject = new Target(this.ns, hostname);
  }

  get target() {
    return this.targetObject;
  }

  async prepareServers() {
    for (const host of this.workpoolServers) {
      if ("home" != host.name) { // We develop here, let's not get things confused.
        let deployableFiles = this.ns.ls("home", "deploy/");
        for (const file of deployableFiles) {
          if (!this.ns.fileExists(file, host.name)) {
            this.log.dbg(`scp home:/${file} ${host.name}:/${file}`);
            await this.ns.scp(file, "home", host.name);
          }
        }
      }
    }
  }

  findWeakenThreadsForImpact(desiredSecurityImpact, coreCount) {
    let threadCount = 1;
    let actualImpact = 0;
    while (actualImpact < desiredSecurityImpact) {
      actualImpact = this.ns.weakenAnalyze(threadCount, coreCount);
      threadCount++;
    }

    return threadCount;
  }

  weakenTarget(target, host, job, projectedDifficulty, executeAfter) {
    let securityGap = projectedDifficulty - target.minDifficulty;
    let weakenThreadsRequired = this.findWeakenThreadsForImpact(securityGap, host.coreCount);

    let totalWeakenRam = this.ds.weakenScriptRam * weakenThreadsRequired;
    let availableRam = host.availableRam;
    // Let's leave a bit of headroom on home if we can spare it to make scripts easier to run.
    if (host.name === "home") {
      if (host.maxRam > 32 && host.maxRam <= 256) {
        availableRam -= 32
      } else if (host.maxRam > 256) {
        availableRam -= 64
      }
    }

    this.log.dbg("securityGap: " + securityGap);
    this.log.dbg("executeAfter: " + executeAfter);
    this.log.dbg("projectedDifficulty: " + projectedDifficulty);
    this.log.dbg("this.ds.weakenScriptRam: " + this.ds.weakenScriptRam);
    this.log.dbg("weakenThreadsRequired: " + weakenThreadsRequired);
    this.log.dbg("totalWeakenRam: " + totalWeakenRam);
    this.log.dbg("availableRam: " + availableRam);

    job.executeAfter = executeAfter;

    if (totalWeakenRam <= host.availableRam) {
      this.log.info("All weaken workload fits in RAM");
      job.addTask("weaken", this.ns.getWeakenTime(this.targetHostname), weakenThreadsRequired);
      return target.minDifficulty;
    } else {
      this.log.info("Can't do all the weakening in one hit - getting done what we can");
      let maxWeakenThreads = Math.floor(host.availableRam / this.ds.weakenScriptRam);
      job.addTask("weaken", this.ns.getWeakenTime(this.targetHostname), maxWeakenThreads);
      return projectedDifficulty - (maxWeakenThreads * 0.05);
    }
  }

  growUsingRam(coreCount, availableRam) {
    let proposedGrowthThreads = 1;
    let proposedWeakenThreads = 1;
    let proposedRamCost = this.ramRequiredFor(proposedGrowthThreads, proposedWeakenThreads);

    if (proposedRamCost > availableRam) {
      // We can't fit any useful workload, bail!
      return [0, 0];
    }

    let maxAttempts = 0;
    let growthThreads, weakenThreads;
    // TODO: some caching here, or some smarter way of finding the right amount of threads?
    // while (proposedRamCost < availableRam && maxAttempts < 60) {
    while (proposedRamCost < availableRam) {
      growthThreads = proposedGrowthThreads;
      weakenThreads = proposedWeakenThreads;
      proposedGrowthThreads += 1;
      proposedWeakenThreads = this.findWeakenThreadsForImpact(this.ns.growthAnalyzeSecurity(proposedGrowthThreads), coreCount);

      proposedRamCost = this.ramRequiredFor(proposedGrowthThreads, proposedWeakenThreads);
      // this.log.dbg(`Proposing growth[${proposedGrowthThreads}] / weaken[${proposedWeakenThreads}] (${proposedRamCost}GB)`)
      maxAttempts += 1;
    }

    return [weakenThreads, growthThreads];
  }

  growTarget(moneyAvailable, moneyMax, host, job, executeAfter) {
    this.log.dbg("moneyMax / moneyAvailable: " + (moneyMax / moneyAvailable));
    let desiredGrowthFactor = moneyMax / moneyAvailable;
    let growThreadsRequired = Math.ceil(this.ns.growthAnalyze(this.targetHostname, desiredGrowthFactor, host.coreCount));
    let weakenThreadsRequired = this.findWeakenThreadsForImpact(this.ns.growthAnalyzeSecurity(growThreadsRequired), host.coreCount);
    let totalRamRequired = this.ramRequiredFor(growThreadsRequired, weakenThreadsRequired);
    this.log.dbg(`growThreadsRequired: ${growThreadsRequired}`);
    this.log.dbg(`weakenThreadsRequired: ${weakenThreadsRequired}`);
    this.log.dbg(`Total ram required: ${totalRamRequired}`);

    job.executeAfter = executeAfter;

    if (totalRamRequired <= host.availableRam) {
      this.log.dbg(`[${host.name}] All grow workload fits in RAM`);
      job.addTask("grow", this.ns.getGrowTime(this.targetHostname), growThreadsRequired);
      job.addTask("weaken", this.ns.getWeakenTime(this.targetHostname), weakenThreadsRequired);
      return true;
    } else {
      this.log.dbg(`[${host.name}] Can't do all grow calls in one go, splitting it (${host.availableRam.toFixed(3)}GB available)`);
      let weakenThreads, growthThreads;
      [weakenThreads, growthThreads] = this.growUsingRam(host.coreCount, host.availableRam);
      job.addTask("grow", this.ns.getGrowTime(this.targetHostname), growthThreads);
      job.addTask("weaken", this.ns.getWeakenTime(this.targetHostname), weakenThreads);
      return false;
    }
  }

  ramRequiredFor(growThreads = 0, weakenThreads = 0, hackThreads = 0) {
    return growThreads * this.ds.growScriptRam +
      weakenThreads * this.ds.weakenScriptRam +
      hackThreads * this.ds.hackScriptRam;
  }

  threadsToHack(target, targetPercentage) {
    let singleThreadFraction = this.ns.hackAnalyze(target);
    return Math.ceil(targetPercentage / singleThreadFraction);
  }

  calculateGrowthFactor(moneyMax, moneyAvailable, actualPercentage) {
    let newBalance = moneyAvailable - (moneyAvailable * actualPercentage);

    // newBalance * factor = moneyMax
    return moneyMax / newBalance;
  }

  hackTarget(target, host, job) {
    // Let's not try to grab more than 95% of the target
    let maxThreads = Math.round(0.95 / this.ns.hackAnalyze(target.name))
    // TODO: I want to wait until most of the ram on the host is available to schedule fewer but bigger jobs:
    let memBudget = host.availableRam
    let hackCost = this.hackOptimiser.findOptimumHackForMemory(target, host.cpuCores, memBudget, 1, maxThreads)

    if (hackCost.get("totalRamNeeded") >= memBudget) {
      this.log.info(`Can't fit any hack workload onto ${host.name}`)
    } else {
      job.addTask("hack", this.ns.getHackTime(target.name), hackCost.get("hackThreads"));
      job.addTask("weaken", this.ns.getWeakenTime(target.name), hackCost.get("weakenThreadsForHack"));
      job.addTask("grow", this.ns.getGrowTime(target.name), hackCost.get("growthThreads"));
      job.addTask("weaken", this.ns.getWeakenTime(target.name), hackCost.get("weakenThreadsForGrow"));
    }
  }

  async run() {
    this.target.updateDetails();
    await this.prepareServers()
    for (let host of this.workpoolServers) {
      this.log.dbg(`Checking schedule for ${host.name}`);
      host.updateDetails()
      if (host.availableRam < this.minimumRamOnHost) {
        continue;
      } else {
        this.log.dbg(`${host.name} has ${host.availableRam}GB to play with, let's go.`);
      }
      let job = new Job(this.ns, this.target);

      let moneyAvailable = this.target.moneyAvailable;
      let moneyMax = this.target.moneyMax;
      this.log.dbg(`moneyAvailable: ${moneyAvailable} moneyMax: ${moneyMax}`);

      let futureHackDifficulty = this.target.hackDifficulty;
      let futureMoneyMax = (this.target.moneyAvailable === this.target.moneyMax);

      let [projectedHackDifficultyChangeTime, projectedHackDifficulty] = this.target.projectedHackDifficulty;
      let [projectedMaxMoneyChangeTime, projectedMoneyMax] = this.target.projectedMoneyMax;

      this.log.dbg(`Checking if weaken is needed: projectedHackDifficulty > this.target.minDifficulty: ${projectedHackDifficulty} > ${this.target.minDifficulty}`);

      if (projectedHackDifficulty > this.target.minDifficulty) {
        futureHackDifficulty = this.weakenTarget(this.target, host, job, projectedHackDifficulty, projectedHackDifficultyChangeTime);
      } else if (!projectedMoneyMax) {
        futureMoneyMax = this.growTarget(moneyAvailable, moneyMax, host, job, projectedMaxMoneyChangeTime);
      } else {
        this.log.dbg(`Server is maximised, time to throw hacks at it`);
        futureMoneyMax = true;
        this.hackTarget(this.target, host, job);
      }

      let output = await job.scheduleOn(host);
      if (output.length > 0 && -1 != output.findIndex(e => e === 0)) {
        this.log.warn(`One of the jobs failed to schedule for job[${job.id}]`);
      } else {
        this.log.dbg(`output from scheduleOn: ${output}`);
      }

      if (futureHackDifficulty != this.target.hackDifficulty) {
        this.log.info(`We're going to change hack difficulty in the future, changing projection.`);
        this.log.dbg(`updateHackDifficultyProjection(job.finishTime, futureHackDifficulty): (updateHackDifficultyProjection(${job.finishTime}, ${futureHackDifficulty}))`);
        this.target.updateHackDifficultyProjection(job.finishTime, futureHackDifficulty);
      }
      if (!(this.target.moneyAvailable == this.target.moneyMax) && futureMoneyMax) {
        this.target.setFutureMoneyMax(job.finishTime, futureMoneyMax);
      }
    }
  }
}
