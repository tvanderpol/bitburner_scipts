/** @param {NS} ns **/

import Logger from "util/logger.js"

export default class {
  constructor(ns, hostname) {
    this.ns = ns;
    this.hostname = hostname;
    this.log = new Logger(ns, `Host[${hostname}]`, false)
    this.details = ns.getServer(hostname);
    this.minRamOnHome = 32
  }

  get name() {
    return this.hostname;
  }

  get coreCount() {
    return this.details.coreCount;
  }

  get maxRam() {
    return this.details.maxRam
  }

  get availableRam() {
    let availableRam = this.details.maxRam - this.details.ramUsed
    if (this.hostname === "home") {
      availableRam -= this.minRamOnHome
    }
    return availableRam;
  }

  updateDetails() {
    this.details = this.ns.getServer(this.name);
  }
}
