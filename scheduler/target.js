/** @param {NS} ns **/

import Logger from "util/logger.js"

export default class {
  constructor(ns, hostname) {
    this.ns = ns
    this.hostname = hostname
    this.log = new Logger(ns, `Target[${hostname}]`, false)
    this.details = this.ns.getServer(hostname)
    // needs to be long enough that whatever loop we run this in can validate the result 
    // before the next timeslot starts.
    this.timeSliceMs = 100
    this.reservations = new Map()
    this.futureHackDifficulty = null
    this.futureHackDifficultyTimestamp
    this.futureMoneyMaxed = this.currentMoneyMaxed
    this.futureMoneyMaxedTimestamp = -1

  }

  get name() {
    return this.hostname;
  }

  get isValidTarget() {
    return this.details.requiredHackingSkill <= this.ns.getHackingLevel() &&
      !this.details.purchasedByPlayer &&
      this.details.hasAdminRights
  }

  get finishedWeakening() {
    // Give the definition of finished a bit of wiggle room
    // so we don't get our wires crossed between finishing minimising
    // and checking to see if it's valid.
    return (this.minDifficulty <= this.hackDifficulty + 1)
  }

  get availableMoneyPercentage() {
    return this.moneyAvailable / this.moneyMax
  }

  get minDifficulty() {
    return this.details.minDifficulty;
  }

  get hackDifficulty() {
    return this.details.hackDifficulty;
  }

  get requiredHackingSkill() {
    return this.details.requiredHackingSkill
  }

  get moneyAvailable() {
    return this.details.moneyAvailable;
  }

  get moneyMax() {
    return this.details.moneyMax;
  }

  get currentMoneyMaxed() {
    return this.moneyAvailable === this.moneyMax
  }

  get score() {
    let rewardRatio = this.moneyMax / this.minDifficulty

    return rewardRatio
  }

  updateDetails() {
    this.details = this.ns.getServer(this.name);
  }

  get projectedHackDifficulty() {
    if (this.futureHackDifficulty != null) {
      this.log.dbg(`futureHackDifficulty() => [this.futureHackDifficultyTimestamp, this.futureHackDifficulty]: [${this.futureHackDifficultyTimestamp}, ${this.futureHackDifficulty}]`)
      this.sanityCheckProjectedHackDifficulty()
      return [this.futureHackDifficultyTimestamp, this.futureHackDifficulty]
    } else {
      this.log.dbg(`No projected hack difficulty, returning current (${this.hackDifficulty})`)
      return [-1, this.hackDifficulty]
    }
  }

  get projectedMoneyMax() {
    if (this.futureMoneyMaxed != null) {
      this.log.dbg(`futureMoneyMaxed() => [this.futureMoneyMaxedTimestamp, this.futureMoneyMaxed]: [${this.futureMoneyMaxedTimestamp}, ${this.futureMoneyMaxed}]`)
      this.sanityCheckProjectedMoneyMax()
      return [this.futureMoneyMaxedTimestamp, this.futureMoneyMaxed]
    } else {
      this.log.dbg(`No projected moneyMaxed, returning current (${this.currentMoneyMaxed})`)
      return [-1, this.currentMoneyMaxed]
    }

  }

  sanityCheckProjectedMoneyMax() {
    if (this.ns.getTimeSinceLastAug() > this.futureMoneyMaxedTimestamp) {
      if (this.futureMoneyMaxed != this.currentMoneyMaxed) {
        this.log.warn(`Money maxed projections are wrong! Expected this.futureMoneyMaxed = this.currentMoneyMaxed but ${this.futureMoneyMaxed}  != ${this.currentMoneyMaxed}`)
        this.futureMoneyMaxed = this.currentMoneyMaxed
        this.futureMoneyMaxedTimestamp = this.ns.getTimeSinceLastAug()
      }
    }
  }

  sanityCheckProjectedHackDifficulty() {
    if (this.ns.getTimeSinceLastAug() > this.futureHackDifficultyTimestamp) {
      if (this.futureHackDifficulty != this.hackDifficulty) {
        this.log.warn(`Hack difficulty projections are wrong! Expected this.futureHackDifficulty == this.hackDifficulty but ${this.futureHackDifficulty}  != ${this.hackDifficulty}`)
        this.futureHackDifficulty = this.hackDifficulty
        this.futureHackDifficultyTimestamp = this.ns.getTimeSinceLastAug()
      }
    }
  }

  updateHackDifficultyProjection(timestamp, level) {
    this.log.info(`security level will be ${level} on ${timestamp}`)
    this.futureHackDifficultyTimestamp = timestamp
    this.futureHackDifficulty = level
  }

  setFutureMoneyMax(timestamp, moneyMax) {
    this.log.dbg(`moneyMax on ${timestamp}: ${moneyMax}`)
    this.futureMoneyMaxedTimestamp = timestamp
    this.futureMoneyMaxed = moneyMax
  }

  reserveTimeslot(slot, jobId) {
    this.reservations.set(slot, jobId);
    this.cleanPastTimeslots()
    return slot;
  }

  firstAvailableSlotFrom(proposedSlot) {
    let slotAvailable = !this.reservations.has(proposedSlot);
    let maxSlotsToCheck = 20;
    let currentSlot = 0;
    while (!slotAvailable && currentSlot < maxSlotsToCheck) {
      proposedSlot += 1000;
      slotAvailable = !this.reservations.has(proposedSlot);
      // this.log.dbg(`Checking ${proposedSlot} - available: ${slotAvailable} (slot nr ${currentSlot})`)
      currentSlot += 1;
    }

    return proposedSlot;
  }

  reserveNextTimeslotAfter(jobId, timestamp) {
    // should check if something is already ending that timeslot
    // round up to nearest second (and add 250ms so that worst case scenario we get at least that much time)
    let proposedTime = (Math.ceil((timestamp + 250) / 1000) * 1000);
    let availableSlot = this.firstAvailableSlotFrom(proposedTime);
    this.log.dbg(`first available slot: ${availableSlot} from proposedTime ${proposedTime}`);
    return this.reserveTimeslot(availableSlot, jobId);
  }

  cleanPastTimeslots() {
    let now = this.ns.getTimeSinceLastAug();
    let pastKeys = []
    for (const key of this.reservations.keys()) {
      if (key < now) {
        pastKeys.push(key)
      }
    }

    for (const key of pastKeys) {
      this.reservations.delete(key)
    }
  }
}
