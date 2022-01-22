/** @param {NS} ns **/

import NF from "util/number_formatter.js"

export default class {
  constructor(ns, messenger, maxRamToUpgradeTo = 4096) {
    this.ns = ns
    this.nf = new NF(ns)
    this.messenger = messenger
    this.minRam = 64
    this.maxRamToUpgradeTo = this.ns.getPurchasedServerMaxRam()
    // this.maxRamToUpgradeTo = maxRamToUpgradeTo
    this.hostnames = this.generateHostNames()
  }

  generateHostNames() {
    let max = this.ns.getPurchasedServerLimit()
    let hostnames = []
    for (let i = 0; i < max; i++) {
      hostnames.push(`pserv-${i}`)
    }
    return hostnames
  }

  serverCapacities() {
    return this.hostnames.map(host => {
      return this.getServerRam(host)
    })
  }

  getServerRam(host) {
    if (this.ns.serverExists(host)) {
      return this.ns.getServer(host).maxRam
    } else {
      return 0
    }
  }

  fleetWideLowestRam() {
    return this.serverCapacities().reduce((acc, next) => Math.min(acc, next), this.maxRamToUpgradeTo)
  }

  smallestServer() {
    let serverIndex = this.serverCapacities().indexOf(this.fleetWideLowestRam())
    return this.hostnames[serverIndex]
  }

  nextUpgradeCost() {
    let hostname = this.smallestServer()
    let currentRam = this.getServerRam(hostname)
    // No less than minimum but don't go over max either:
    let smallestUpgradeRam = Math.max(currentRam * 2, this.minRam)
    smallestUpgradeRam = Math.min(smallestUpgradeRam, this.maxRamToUpgradeTo)

    return this.ns.getPurchasedServerCost(smallestUpgradeRam)
  }

  findUpgradeInBudgetFor(currentRam, budget) {
    let proposedPrice = this.ns.getPurchasedServerCost(currentRam)
    let targetRam = currentRam
    let proposedTargetRam = currentRam
    // this.ns.tprint("Going to loop, currentRam: " + currentRam + " budget: " + this.nf.money(budget))
    // this.ns.tprint("targetRam: " + targetRam + ", proposedTargetRam: " + proposedTargetRam)
    while (proposedPrice < budget) {
      targetRam = proposedTargetRam
      if (targetRam === this.maxRamToUpgradeTo) {
        break;
      }
      proposedTargetRam = Math.min(targetRam * 2, this.maxRamToUpgradeTo)
      proposedPrice = this.ns.getPurchasedServerCost(proposedTargetRam)
    }

    return targetRam;
  }

  buyServer(hostname, targetRam) {
    if (this.ns.serverExists(hostname)) {
      this.ns.killall(hostname)
      this.ns.deleteServer(hostname)
    }
    this.ns.purchaseServer(hostname, targetRam)
  }

  upgradesRemaining() {
    let smallestServer = this.smallestServer()
    if (smallestServer === undefined) {
      return false
    } else {
      return this.getServerRam(smallestServer) < this.maxRamToUpgradeTo
    }
  }

  // TODO: This needs to return some kind of finished state when all servers have maxRam
  buyNextUpgrade(budget = 0) {
    let hostname = this.smallestServer()
    let currentRam = this.fleetWideLowestRam()
    let targetRam = Math.max(currentRam * 2, this.minRam)
    if (currentRam < targetRam) {
      this.messenger.queue("Upgrading [" + hostname + "] from " + currentRam + "GB to " + targetRam + "GB for " + this.nf.money(this.ns.getPurchasedServerCost(targetRam)), "success")
      let boughtServer = this.buyServer(hostname, targetRam)
      if ("" === boughtServer) {
        this.messenger.queue("Somehow failed to buy " + hostname + " :(", "error")
      }
    }

    if (budget != 0) {
      targetRam = this.findUpgradeInBudgetFor(targetRam, budget)
    }
  }
}