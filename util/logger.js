/** @param {NS} ns **/

import NumberFormatter from "util/number_formatter"

export default class {
  constructor(ns, prefix = "", debug = false) {
    this.ns = ns
    this.nf = new NumberFormatter(ns)
    this.prefix = prefix
    this.debug = debug
  }

  dbg(msg) {
    if (this.debug) {
      this.emit("debug", msg)
    }
  }

  info(msg) {
    this.emit("info", msg)
  }

  warn(msg) {
    this.emit("warning", msg)
  }

  error(msg) {
    this.emit("error", msg)
  }

  emit(lvl, msg) {
    this.ns.print(`@${this.nf.timeSinceAug()}\t[${this.prefix}] ${lvl.toUpperCase()}: ${msg}`)
  }
}