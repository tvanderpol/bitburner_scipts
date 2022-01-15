/** @param {NS} ns **/

export default class {
  constructor(ns) {
    this.ns = ns
    this.hScript = "/deploy/hack.js"
    this.hScriptRam = ns.getScriptRam(this.hScript)
    this.gScript = "/deploy/grow.js"
    this.gScriptRam = ns.getScriptRam(this.gScript)
    this.wScript = "/deploy/weaken.js"
    this.wScriptRam = ns.getScriptRam(this.wScript)
  }

  get hackScript() {
    return this.hScript
  }
  get hackScriptRam() {
    return this.hScriptRam
  }
  get growScript() {
    return this.gScript
  }
  get growScriptRam() {
    return this.gScriptRam
  }
  get weakenScript() {
    return this.wScript
  }
  get weakenScriptRam() {
    return this.wScriptRam
  }
}