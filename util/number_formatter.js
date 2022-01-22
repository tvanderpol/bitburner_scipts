/** @param {NS} ns **/
export default class {
  constructor(ns) {
    this.ns = ns
    this.MONEY_FMT = '($0.000a)'
    this.NUM_FMT = '0.000a'
  }

  num(number) {
    return this.ns.nFormat(number, this.NUM_FMT)
  }

  money(number) {
    return this.ns.nFormat(number, this.MONEY_FMT)
  }

  msToHMS(duration) {

    let seconds = parseInt((duration / 1000) % 60)
    let minutes = parseInt((duration / (1000 * 60)) % 60)
    let hours = parseInt((duration / (1000 * 60 * 60)))

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return `${hours}:${minutes}:${seconds}`
  }

  timeSinceAug() {
    return this.msToHMS(this.ns.getTimeSinceLastAug())
  }
}