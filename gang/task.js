/** @param {NS} ns **/

import NF from "util/number_formatter.js"

export default class {
  constructor(ns, messenger, task, member) {
    this.ns = ns
    this.messenger = messenger
    this.task = task
    this.member = member
  }

  get totalStatFactor() {
    return (
      (this.member.hack * this.task['hackWeight'])
      + (this.member.agi * this.task['agiWeight'])
      + (this.member.cha * this.task['chaWeight'])
      + (this.member.str * this.task['strWeight'])
      + (this.member.def * this.task['defWeight'])
      + (this.member.dex * this.task['dexWeight'])
    )
  }

  get description() {
    return `${this.member.name} considers '${this.task['name']}': effectiveRespect: ${this.effectiveRespect}, effectiveMoney: ${this.effectiveMoney}, relativeDifficulty: ${this.relativeDifficulty}`
  }

  get effectiveRespect() {
    return (this.task['baseRespect'] * this.totalStatFactor) / this.task['difficulty']
  }

  get effectiveMoney() {
    return (this.task['baseMoney'] * this.totalStatFactor) / this.task['difficulty']
  }

  get relativeDifficulty() {
    return (this.task['difficulty'] / this.member.sumOfCombatStats) * 1000
  }
}