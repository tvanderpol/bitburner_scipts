import DeployedScripts from "util/deployed_scripts.js";

export default class {
  constructor(ns, logger) {
    this.ns = ns;
    this.log = logger
    this.ds = new DeployedScripts(ns);
    this.costCache = new Map();
  }

  getCachedCostFor(playerHackSkill, coreCount, targetName, hackThreads) {
    if (this.costCache.has(playerHackSkill)) {
      // this.log.dbg(`Have existing cache for skill ${playerHackSkill}`)
      let cacheForHackSkill = this.costCache.get(playerHackSkill);
      let cachedResult = cacheForHackSkill.get(this.cacheKeyFor(targetName, coreCount, hackThreads));
      if (cachedResult === undefined) {
        return null;
      } else {
        // this.log.dbg(`Result found for ${this.cacheKeyFor(targetName, coreCount, hackThreads)}`)
        return cachedResult;
      }
    } else {
      return null;
    }
  }

  setCachedCostFor(playerHackSkill, coreCount, targetName, hackThreads, cost) {
    if (this.costCache.has(playerHackSkill)) {
      // this.log.dbg(`Started cache for skill level ${playerHackSkill} already, adding this cost entry`)
      let cacheForHackSkill = this.costCache.get(playerHackSkill);
      cacheForHackSkill.set(this.cacheKeyFor(targetName, coreCount, hackThreads), cost);
    } else {
      // this.log.dbg(`Player reached new skill level, nuking cache`)
      this.costCache.clear();
      let entry = new Map([[this.cacheKeyFor(targetName, coreCount, hackThreads), cost]]);
      this.costCache.set(playerHackSkill, entry);
    }
  }

  cacheKeyFor(targetName, coreCount, hackThreads) {
    return `${targetName}-${coreCount}-${hackThreads}`;
  }

  calculateGrowthFactor(moneyMax, moneyAvailable, actualPercentage) {
    let newBalance = moneyAvailable - (moneyAvailable * actualPercentage);

    // newBalance * factor = moneyMax
    let growthFactor = moneyMax / newBalance

    if (growthFactor === Infinity || growthFactor === NaN) {
      // Whoops we overdid it earlier by accident
      growthFactor = 100
    } else if (growthFactor < 1) {
      growthFactor = 1
    }

    return growthFactor;
  }

  findWeakenThreadsForImpact(desiredSecurityImpact, coreCount) {
    return Math.ceil(desiredSecurityImpact / this.ns.weakenAnalyze(1, coreCount));
  }

  ramRequiredFor(growThreads = 0, weakenThreads = 0, hackThreads = 0) {
    return growThreads * this.ds.growScriptRam +
      weakenThreads * this.ds.weakenScriptRam +
      hackThreads * this.ds.hackScriptRam;
  }

  getHackingCostFor(coreCount, target, hackThreads) {
    const hackSecurityImpact = this.ns.hackAnalyzeSecurity(hackThreads);
    const weakenThreadsForHack = this.findWeakenThreadsForImpact(hackSecurityImpact, coreCount);
    const actualPercentage = hackThreads * this.ns.hackAnalyze(target.name);
    const growthFactor = this.calculateGrowthFactor(target.moneyMax, target.moneyAvailable, actualPercentage);
    const growthThreads = Math.ceil(this.ns.growthAnalyze(target.name, growthFactor, coreCount));
    const growthSecurityImpact = this.ns.growthAnalyzeSecurity(growthThreads);
    const weakenThreadsForGrow = this.findWeakenThreadsForImpact(growthSecurityImpact, coreCount);

    return new Map([
      ["hackThreads", hackThreads],
      ["weakenThreadsForHack", weakenThreadsForHack],
      ["growthThreads", growthThreads],
      ["weakenThreadsForGrow", weakenThreadsForGrow],
      ["totalRamNeeded", this.ramRequiredFor(growthThreads, weakenThreadsForHack + weakenThreadsForGrow, hackThreads)],
    ]);
  }

  costToHackTarget(target, coreCount, hackThreads) {
    const playerHackSkill = this.ns.getPlayer().hacking;
    let cachedResult = this.getCachedCostFor(playerHackSkill, coreCount, target.name, hackThreads);
    if (cachedResult != null) {
      return cachedResult;
    } else {
      const calculatedCost = this.getHackingCostFor(coreCount, target, hackThreads);
      this.setCachedCostFor(playerHackSkill, coreCount, target.name, hackThreads, calculatedCost);
      return calculatedCost;
    }
  }

  findOptimumHackForMemory(target, coreCount, memBudget, minThread = 1, maxThread = 100) {
    // this.log.dbg(`Going in with: ${minThread} - ${maxThread}`)
    if (maxThread - minThread < 2) {
      // this.log.dbg(`Min and max converged: ${minThread} - ${maxThread}`)
      const finalCost = this.costToHackTarget(target, coreCount, minThread);
      // this.log.dbg(`Costs for ${minThread} threads: ${this.debugRendercost(finalCost)}`)
      return finalCost;
    }
    let mid = Math.round((minThread + maxThread) / 2);
    let midCost = this.costToHackTarget(target, coreCount, mid);
    if (midCost.get("totalRamNeeded") > memBudget) {
      // this.log.dbg(`Can't do ${mid} threads in ${memBudget}GB - it costs ${midCost.get("totalRamNeeded")}GB`)
      return this.findOptimumHackForMemory(target, coreCount, memBudget, minThread, mid);
    } else {
      // this.log.dbg(`${mid} threads fits in ${memBudget}GB - it costs ${midCost.get("totalRamNeeded")}`)
      return this.findOptimumHackForMemory(target, coreCount, memBudget, mid, maxThread);
    }
  }

  debugRendercost(cost) {
    let response = [];
    for (const [key, value] of cost.entries()) {
      response.push(key + ': ' + value);
    }
    return `{${response.join(", ")}}`;
  }

  csvRendercost(cost) {
    let response = [];
    for (const [key, value] of cost.entries()) {
      response.push(key + ': ' + value);
    }
    return `{${response.join(", ")}}`;
  }
}
