/** @param {NS} ns **/

export const MONEY_FMT = '($0.000a)'
export const NUM_FMT = '0.000a'

export default class {
    constructor(ns, messenger) {
        this.ns = ns
        this.messenger = messenger
        this.minRam = 64
        this.maxPossibleRam = this.ns.getPurchasedServerMaxRam()
        this.hostnames = this.generateHostNames()
    }

    generateHostNames() {
        let max = this.ns.getPurchasedServerLimit()
        let hostnames = []
        for(let i = 0; i < max; i++) {
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
        if(this.ns.serverExists(host)) {
            return this.ns.getServer(host).maxRam
        } else {
            return 0
        }
    }

    fleetWideLowestRam() {
        return this.serverCapacities().reduce((acc, next) => Math.min(acc, next), this.maxPossibleRam)
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
        smallestUpgradeRam = Math.min(smallestUpgradeRam, this.maxPossibleRam)

        return this.ns.getPurchasedServerCost(smallestUpgradeRam)
    }

    findUpgradeInBudgetFor(currentRam, budget) {
        let proposedPrice = 0
        let targetRam = currentRam
        let proposedTargetRam = currentRam
        while(proposedPrice < budget) {
            targetRam = proposedTargetRam
            if(targetRam === this.maxPossibleRam) {
                break;
            }
            proposedTargetRam = Math.min(targetRam * 2, this.maxPossibleRam)
            proposedPrice = this.ns.getPurchasedServerCost(targetRam)
        }

        return targetRam;
    }

    buyServer(hostname, targetRam) {
        if(this.ns.serverExists(hostname)) {
            this.ns.killall(hostname)
            this.ns.deleteServer(hostname)
        }
        this.ns.purchaseServer(hostname, targetRam)
    }

    upgradesRemaining() {
        return this.getServerRam(this.smallestServer()) < this.maxPossibleRam 
    }

    // TODO: This needs to return some kind of finished state when all servers have maxRam
    buyNextUpgrade(budget = 0) {
        let hostname = this.smallestServer()
        let currentRam = this.fleetWideLowestRam()
        let targetRam = Math.max(currentRam * 2, this.minRam)
        
        if(budget != 0) {
            targetRam = this.findUpgradeInBudgetFor(targetRam, budget)
        }

        this.messenger.queue("Upgrading [" + hostname + "] from " + currentRam + "GB to " + targetRam + "GB", "success")
        let boughtServer = this.buyServer(hostname, targetRam)
        if("" === boughtServer) {
            this.messenger.queue("Somehow failed to buy " + hostname + " :(", "error")
        }
    }
}