/** @param {NS} ns **/
export default class {
  constructor(ns) {
    this.ns = ns
    this.hScript = "hack.js"
    this.hScriptRam = ns.getScriptRam(this.hScript)
    this.gScript = "grow.js"
    this.gScriptRam = ns.getScriptRam(this.gScript)
    this.wScript = "weaken.js"
    this.wScriptRam = ns.getScriptRam(this.wScript)
  }

  get hackScript() {
    return this.hScript
  }
  get hackScriptRam() {
    this.hScriptRam
  }
  get growScript() {
    this.gScript
  }
  get growScriptRam() {
    this.gScriptRam
  }
  get weakenScript() {
    this.wScript
  }
  get weakenScriptRam() {
    this.wScriptRam
  }
}