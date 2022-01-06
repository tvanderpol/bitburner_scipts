/** @param {NS} ns **/

import Logger from "util/logger.js"

export default class {
  constructor(ns, hostname) {
    this.ns = ns;
    this.hostname = hostname;
    this.log = new Logger(ns, `Host[${hostname}]`, true)
    this.details = ns.getServer(hostname);
    this.weakenTime = ns.getWeakenTime(hostname);
    this.growTime = ns.getGrowTime(hostname);
    this.hacktime = ns.getHackTime(hostname);
  }

  get name() {
    return this.hostname;
  }

  get coreCount() {
    return this.details.coreCount;
  }

  get availableRam() {
    return this.details.maxRam - this.details.ramUsed;
  }
}
