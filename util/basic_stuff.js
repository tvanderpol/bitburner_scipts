/** @param {NS} ns **/
export default class {
  constructor(ns) {
    this.ns = ns
  }

  average(arr) {
    return arr.reduce((p, c) => p + c, 0) / arr.length
  }
}