/** @param {NS} ns **/

import Logger from "util/logger.js"

export default class {
  constructor(ns, hostname) {
    this.ns = ns;
    this.hostname = hostname;
    this.log = new Logger(ns, `Target[${hostname}]`, true)
    this.details = this.ns.getServer(hostname);
    // needs to be long enough that whatever loop we run this in can validate the result 
    // before the next timeslot starts.
    this.timeSliceMs = 100;
    this.reservations = new Map();
    this.futureHackDifficulty = null;
    this.futureHackDifficultyTimestamp;
  }

  get name() {
    return this.hostname;
  }

  get minDifficulty() {
    return this.details.minDifficulty;
  }
  get hackDifficulty() {
    return this.details.hackDifficulty;
  }
  get moneyAvailable() {
    return this.details.moneyAvailable;
  }
  get moneyMax() {
    return this.details.moneyMax;
  }

  updateDetails() {
    this.details = this.ns.getServer(this.name);
  }

  get projectedHackDifficulty() {
    if (this.futureHackDifficulty != null) {
      this.log.dbg(`futureHackDifficulty() => [this.futureHackDifficultyTimestamp, this.futureHackDifficulty]: [${this.futureHackDifficultyTimestamp}, ${this.futureHackDifficulty}]`)
      return [this.futureHackDifficultyTimestamp, this.futureHackDifficulty]
    } else {
      this.log.dbg(`No projected hack difficulty, returning current (${this.hackDifficulty})`)
      return [-1, this.hackDifficulty]
    }

  }

  updateHackDifficultyProjection(timestamp, level) {
    this.log.info(`security level will be ${level} on ${timestamp}`)
    this.futureHackDifficultyTimestamp = timestamp
    this.futureHackDifficulty = level
  }

  setFutureMoneyMax(timestamp, moneyMax) {
    this.log.info(`moneyMax on ${timestamp}: ${moneyMax}`)
  }

  reserveTimeslot(slot, jobId) {
    this.reservations.set(slot, jobId);
    return slot;
  }

  firstAvailableSlotFrom(proposedSlot) {
    let slotAvailable = !this.reservations.has(proposedSlot);
    let maxSlotsToCheck = 20;
    let currentSlot = 0;
    while (!slotAvailable && currentSlot < maxSlotsToCheck) {
      proposedSlot += 1000;
      slotAvailable = !this.reservations.has(proposedSlot);
      this.log.dbg(`Checking ${proposedSlot} - available: ${slotAvailable} (slot nr ${currentSlot})`);
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

  validateTimeslots() {
    // once a timeslot has expired, check that the target is in fact still maximised
    // and delete the entry.
  }
}
