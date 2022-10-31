/** @param {NS} ns **/

import NF from "util/number_formatter.js"
import Task from "gang/task"

export default class {
  constructor(ns, messenger, name) {
    this.ns = ns
    this.messenger = messenger
    this.name = name
    this.nf = new NF(ns)
    this.taskChanged = 0 // Set to lastAug time when task switches
    this.availableTasks = this.ns.gang.getTaskNames()
      .map(name => this.ns.gang.getTaskStats(name))
      .filter(name => name != 'Unassigned')
    this.details = ns.gang.getMemberInformation(name)
    this.potentialAscenscionValues = ns.gang.getAscensionResult(this.name)
    this.hackAscenscionWeight = 1
    this.strAscenscionWeight = 1
    this.defAscenscionWeight = 1
    this.dexAscenscionWeight = 1
    this.agiAscenscionWeight = 1
    this.chaAscenscionWeight = 1
    this.difficultyThreshold = 20
  }

  get augmentations() {
    return this.details['augmentations']
  }

  get highestStat() {
    return Math.max(this.hack, this.str, this.def, this.dex, this.agi, this.cha)
  }

  get combatRating() {
    return this.strAscBonus + this.defAscBonus + this.dexAscBonus + this.agiAscBonus
  }

  get hackRating() {
    return this.hackAscBonus * 3 + this.chaAscBonus
  }

  get totalAscenscionBonus() {
    return this.potentialHackAscenscionBonus * this.hackAscenscionWeight +
      this.potentialStrAscenscionBonus * this.strAscenscionWeight +
      this.potentialDefAscenscionBonus * this.defAscenscionWeight +
      this.potentialDexAscenscionBonus * this.dexAscenscionWeight +
      this.potentialAgiAscenscionBonus * this.agiAscenscionWeight +
      this.potentialChaAscenscionBonus * this.chaAscenscionWeight
  }

  get potentialHackAscenscionBonus() {
    return this.potentialAscenscionValueForStat('hack')
  }

  get potentialStrAscenscionBonus() {
    return this.potentialAscenscionValueForStat('str')
  }

  get potentialDefAscenscionBonus() {
    return this.potentialAscenscionValueForStat('def')
  }

  get potentialDexAscenscionBonus() {
    return this.potentialAscenscionValueForStat('dex')
  }

  get potentialAgiAscenscionBonus() {
    return this.potentialAscenscionValueForStat('agi')
  }

  get potentialChaAscenscionBonus() {
    return this.potentialAscenscionValueForStat('cha')
  }

  get hack() {
    return this.details['hack']
  }

  get str() {
    return this.details['str']
  }

  get def() {
    return this.details['def']
  }

  get dex() {
    return this.details['dex']
  }

  get agi() {
    return this.details['agi']
  }

  get cha() {
    return this.details['cha']
  }

  get sumOfCombatStats() {
    return this.str + this.def + this.agi + this.dex
  }

  get hackAscBonus() {
    return this.details['hack_asc_mult']
  }

  get strAscBonus() {
    return this.details['str_asc_mult']
  }

  get defAscBonus() {
    return this.details['def_asc_mult']
  }

  get dexAscBonus() {
    return this.details['dex_asc_mult']
  }

  get agiAscBonus() {
    return this.details['agi_asc_mult']
  }

  get chaAscBonus() {
    return this.details['cha_asc_mult']
  }

  get task() {
    return this.details['task']
  }

  get isTraining() {
    return this.task === 'Training Hacking' || this.task === 'Training Combat'
  }

  startEffectiveInfluenceTask() {
    let tasks = this.availableTasks
      .map(task => new Task(this.ns, this.messenger, task, this))
      .filter(task => task.effectiveRespect > 0)
      .filter(task => task.relativeDifficulty < this.difficultyThreshold)
      .sort((a, b) => a.effectiveRespect - b.effectiveRespect)

    // this.ns.print(tasks.map(t => t.description).join("\n"))

    this.setTask(tasks[0].name)
  }

  startMaxMoneyTask() {
    let tasks = this.availableTasks
      .sort((a, b) => b['baseMoney'] - a['baseMoney'])

    this.setTask(tasks[0].name)
  }

  setTask(taskName) {
    if (!this.ns.gang.getTaskNames().includes(taskName)) {
      this.messenger.queue(`[${this.name}] No task named ${taskName}!`, 'error')
    } else {
      this.taskChanged = this.ns.getTimeSinceLastAug()
      this.ns.gang.setMemberTask(this.name, taskName)
    }
  }

  potentialAscenscionValueForStat(stat) {
    if (this.potentialAscenscionValues !== undefined) {
      return this.potentialAscenscionValues[stat] - 1
    } else {
      return 0
    }
  }

  updateDetails() {
    this.details = this.ns.gang.getMemberInformation(this.name)
    this.potentialAscenscionValues = this.ns.gang.getAscensionResult(this.name)
  }

  buyUpgrades() {
    const ownedUpgrades = this.details['upgrades'] + this.details['augmentations']
    const allEquipment = this.ns.gang.getEquipmentNames()
    const currentBalance = this.ns.getServerMoneyAvailable("home")
    let boughtSomething = false
    for (const equipmentName of allEquipment) {
      if (!ownedUpgrades.includes(equipmentName)) {
        const equipmentCost = this.ns.gang.getEquipmentCost(equipmentName)
        if (equipmentCost <= currentBalance / 0.01) {
          boughtSomething = true
          this.ns.gang.purchaseEquipment(this.name, equipmentName)
        }
      }
    }
    if (boughtSomething) {
      this.messenger.queue(`${this.name} went shopping and got everything we could easily afford.`, 'info')
    }
  }
}