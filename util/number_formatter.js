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

}