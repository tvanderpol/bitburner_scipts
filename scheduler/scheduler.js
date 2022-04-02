import HackOptimiser from "scheduler/hack_optimiser";
import Host from "scheduler/host.js";
import Job from "scheduler/job.js";
import Target from "scheduler/target.js";
import DeployedScripts from "util/deployed_scripts.js";
import Logger from "util/logger.js";

export default class {
  constructor(ns, messenger, networkScanner) {
    this.ns = ns;
    this.messenger = messenger
    this.networkScanner = networkScanner
    this.ds = new DeployedScripts(ns);
    this.hackOptimiser = new HackOptimiser(ns, new Logger(ns, 'hackOptimiser', true))
    this.minimumRamOnHost = this.ds.weakenScriptRam + this.ds.growScriptRam;
    this.log = new Logger(ns, "Scheduler", false)

    this.workpoolHosts = []
    this.targetList = []

    this.targetHostname = ""
    this.targetObject = null
    this.nextTargetHostname = ""
    this.nextTargetObject = null

    this.log.info(`Started. Minimum hostRam ${this.minimumRamOnHost}GB`);
  }

  set workpoolServers(serverList) {
    this.workpoolHosts = serverList
      .map(s => s.hostname)
      .map(name => new Host(this.ns, name))
  }

  get workpoolServers() {
    return this.workpoolHosts
  }

  set target(hostname) {
    if (this.targetHostname != hostname && hostname != undefined) {
      this.ns.tprint(`Overmind turns its gaze to ${hostname}`)
      this.messenger.queue(`Target set to ${hostname}`, "success");
      this.targetHostname = hostname;
      this.targetObject = new Target(this.ns, hostname);
    }
  }

  set nextTarget(hostname) {
    if (hostname === null) {
      this.nextTargetHostname = null;
      this.nextTargetObject = null
    } else if (this.nextTargetHostname != hostname && hostname != undefined) {
      this.ns.tprint(`Overmind considers ${hostname} to be next!`)
      this.messenger.queue(`nextTarget set to ${hostname}`, "success");
      this.nextTargetHostname = hostname;
      this.nextTargetObject = new Target(this.ns, hostname);
    }
  }

  get target() {
    return this.targetObject;
  }

  get nextTarget() {
    return this.nextTargetObject;
  }

  reconsiderTargets() {
    if (this.networkScanner.minSecurityTargetList().length < 1 && this.networkScanner.currentTargetList().length < 1) {
      return
    }

    let topMinSecurityTarget = this.networkScanner.minSecurityTargetList()[0]
    let topGlobalTarget = this.networkScanner.currentTargetList()[0]
    if (this.target === null || this.target === undefined) {
      if (topMinSecurityTarget) {
        this.target = topMinSecurityTarget.name
      } else {
        this.target = topGlobalTarget.name
        this.nextTarget = null
        // There's no other useful targets and no min security target, some of the code
        // below expects there to be at least one of each type of target
        // so it blows up with nulls.
        return
      }
    }
    if (this.target.name == topGlobalTarget.name && !topMinSecurityTarget) {
      // As above, we don't have a min security target, bail.
      return
    }
    if (this.target.name != topMinSecurityTarget.name && this.target.score < topMinSecurityTarget.score) {
      this.log.info(`${topMinSecurityTarget.name} has minimum security and is better, switching`)
      this.target = topMinSecurityTarget.name
    }
    if (this.target.name != topGlobalTarget.name && this.target.score < topGlobalTarget.score) {
      if (this.nextTarget === null || (this.nextTarget.name != topGlobalTarget.name && this.nextTarget.score < topGlobalTarget.score)) {
        this.log.info(`Current nextTarget is not the juiciest anymore, ${topGlobalTarget.name} is`)
        this.nextTarget = topGlobalTarget.name
      }
    }
    if (this.nextTarget != null && this.target.score > this.nextTarget.score) {
      this.log.info(`[Target: ${this.target.name}, nextTarget: ${this.nextTarget.name}]We've somehow lapped our nextTarget, let's not waste cycles on it`)
      this.nextTarget = null
    }
    if (this.target != null && this.nextTarget != null && this.target.name == this.nextTarget.name) {
      this.log.info(`[Target: ${this.target.name}, nextTarget: ${this.nextTarget.name}] Target and nextTarget are identical, clearing nextTarget as it adds no value`)
      this.nextTarget = null
    }
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
    return Math.ceil(desiredSecurityImpact / this.ns.weakenAnalyze(1, coreCount));
  }

  weakenTarget(target, host, job, projectedDifficulty, executeAfter) {
    let securityGap = projectedDifficulty - target.minDifficulty;
    let weakenThreadsRequired = this.findWeakenThreadsForImpact(securityGap, host.coreCount);

    let totalWeakenRam = this.ds.weakenScriptRam * weakenThreadsRequired;
    let availableRam = host.availableRam;
    // Let's leave a bit of headroom on home if we can spare it to make scripts easier to run.
    if (host.name === "home") {
      if (host.maxRam <= 256) {
        availableRam = 0
      } else if (host.maxRam > 256) {
        availableRam -= 256
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
    // It goes pretty deep sometimes
    // while (proposedRamCost < availableRam && maxAttempts < 60) {
    while (proposedRamCost < availableRam) {
      growthThreads = proposedGrowthThreads;
      weakenThreads = proposedWeakenThreads;
      proposedGrowthThreads += 1;
      proposedWeakenThreads = this.findWeakenThreadsForImpact(this.ns.growthAnalyzeSecurity(proposedGrowthThreads), coreCount);

      proposedRamCost = this.ramRequiredFor(proposedGrowthThreads, proposedWeakenThreads);
      //this.ns.tprint(`[${this.ns.getTimeSinceLastAug()}] while in scheduler.growUsingRam() (attempts ${maxAttempts})`)
      maxAttempts += 1
    }

    return [weakenThreads, growthThreads];
  }

  growTarget(moneyAvailable, moneyMax, host, job, executeAfter) {
    this.log.dbg("moneyMax / moneyAvailable: " + (moneyMax / moneyAvailable));
    let desiredGrowthFactor = moneyMax / moneyAvailable;
    if (desiredGrowthFactor === Infinity) {
      // Whoops we overdid it earlier by accident
      desiredGrowthFactor = 100
    }
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

  hackTarget(target, host, job) {
    // Let's not try to grab more than 95% of the target
    // Let's also not try for more than 50k threads (this becomes infinity sometimes)
    let maxThreads = Math.min(Math.round(0.95 / this.ns.hackAnalyze(target.name)), 50000)
    // TODO: I want to wait until most of the ram on the host is available to schedule fewer but bigger jobs:
    let memBudget = host.availableRam
    let hackCost = this.hackOptimiser.findOptimumHackForMemory(target, host.cpuCores, memBudget, 1, maxThreads)

    if (hackCost.get("totalRamNeeded") < memBudget) {
      job.addTask("hack", this.ns.getHackTime(target.name), hackCost.get("hackThreads"));
      job.addTask("weaken", this.ns.getWeakenTime(target.name), hackCost.get("weakenThreadsForHack"));
      job.addTask("grow", this.ns.getGrowTime(target.name), hackCost.get("growthThreads"));
      job.addTask("weaken", this.ns.getWeakenTime(target.name), hackCost.get("weakenThreadsForGrow"));
    } else {
      // TODO: Throw this into weaking nextTarget
    }
  }

  async run() {
    this.reconsiderTargets()
    if (this.target === null || this.target === undefined) {
      this.ns.tprint("ERROR BEEP BOOP NO TARGET!!")
    }
    this.target.updateDetails()
    await this.prepareServers()

    for (let host of this.workpoolServers) {
      this.log.dbg(`Checking schedule for ${host.name}`);
      host.updateDetails()
      if (host.availableRam)
        if (host.availableRam < this.minimumRamOnHost) {
          continue
        } else if ((host.availableRam / host.maxRam) < 0.2) {
          // Let's not schedule a million tiny jobs, wait until we have at least a chunk of memory available
          continue
        } else {
          this.log.dbg(`${host.name} has ${host.availableRam}GB to play with, let's go.`);
        }

      let target = this.target
      if (this.nextTarget != null && !this.nextTarget.finishedWeakening && Math.random() > 0.9) {
        target = this.nextTarget
        this.log.info(`[${host.name}] Getting a head start on our next target - ${target.name}`)
      }
      let job = new Job(this.ns, target);

      let moneyAvailable = target.moneyAvailable;
      let moneyMax = target.moneyMax;
      this.log.dbg(`moneyAvailable: ${moneyAvailable} moneyMax: ${moneyMax}`);

      let futureHackDifficulty = target.hackDifficulty;
      let futureMoneyMax = (target.moneyAvailable === target.moneyMax);

      let [projectedHackDifficultyChangeTime, projectedHackDifficulty] = target.projectedHackDifficulty;
      let [projectedMaxMoneyChangeTime, projectedMoneyMax] = target.projectedMoneyMax;

      this.log.dbg(`Checking if weaken is needed: projectedHackDifficulty > target.minDifficulty: ${projectedHackDifficulty} > ${target.minDifficulty}`);

      if (projectedHackDifficulty > target.minDifficulty) {
        futureHackDifficulty = this.weakenTarget(target, host, job, projectedHackDifficulty, projectedHackDifficultyChangeTime);
      } else if (!projectedMoneyMax) {
        futureMoneyMax = this.growTarget(moneyAvailable, moneyMax, host, job, projectedMaxMoneyChangeTime);
      } else {
        this.log.dbg(`Server is maximised, time to throw hacks at it`);
        futureMoneyMax = true;
        this.hackTarget(target, host, job);
      }

      let output = await job.scheduleOn(host);
      if (output.length > 0 && -1 != output.findIndex(e => e === 0)) {
        this.log.warn(`One of the jobs failed to schedule for job[${job.id}] (${output})`);
      } else {
        this.log.dbg(`output from scheduleOn: ${output}`);
      }

      if (futureHackDifficulty != target.hackDifficulty) {
        this.log.info(`We're going to change hack difficulty in the future, changing projection.`);
        this.log.dbg(`updateHackDifficultyProjection(job.finishTime, futureHackDifficulty): (updateHackDifficultyProjection(${job.finishTime}, ${futureHackDifficulty}))`);
        if (job.finishTime === null) {
          if (job.taskCount != 0) {
            this.log.warn(`Job id ${job.id} has a finish time of null but has actual tasks associated!`)
          }
        } else {
          target.updateHackDifficultyProjection(job.finishTime, futureHackDifficulty);
        }
      }
      if (!(target.moneyAvailable == target.moneyMax) && futureMoneyMax) {
        if (job.finishTime === null) {
          if (job.taskCount != 0) {
            this.log.warn(`Job id ${job.id} has a finish time of null but has actual tasks associated!`)
          }
        } else {
          target.setFutureMoneyMax(job.finishTime, futureMoneyMax);
        }
      }
    }
  }
}
