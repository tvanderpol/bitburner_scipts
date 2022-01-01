/** @param {NS} ns **/
export default class {
    constructor(ns, messenger) {
        this.ns = ns
        this.messenger = messenger
        this.serverList = new Map()
    }

    get allServerHostnames() {
        let hostnames = []
        this.serverList.forEach((_, hostname) => hostnames.push(hostname))
        return hostnames
    }

    get allRootedServers() {
        let hostnames = []
        this.serverList.forEach((_, hostname) => hostnames.push(hostname))
        return hostnames
    }


    currentTargetList(targetCount = 3) {
        return this.allServerHostnames
            .map(s => this.ns.getServer(s))
            .filter(s => s.requiredHackingSkill <= this.ns.getHackingLevel())
            .filter(s => s.hasAdminRights)
            .sort((a, b) => this.scoreServer(b) - this.scoreServer(a))
            .slice(0, targetCount)
    }

    breachAll() {
        return this.allServerHostnames
            .map(host => this.breach(host))
            .filter(breachResult => !breachResult)
            .length
    }

    serverEntryFor(hostname, parent, explored = false) {
        if (this.serverList.has(hostname)) {
            return this.serverList.get(hostname)
        } else {
            this.serverList.set(hostname, { hostname: hostname, parent: parent, explored: explored })
            return this.serverList.get(hostname)
        }
    }

    mapServers() {
        let queue = []
        let root = this.serverEntryFor("home", null)
        queue.push(root)
        while (queue.length > 0) {
            let target = queue.pop()
            if (!target["explored"]) {
                let children = this.ns.scan(target["hostname"])
                if (children.length > 0) {
                    children.forEach(c => queue.push(this.serverEntryFor(c, target)))
                }
                target["explored"] = true
            }
        }
    }

    scoreServer(s) {
        let rewardRatio = s.moneyMax / s.minDifficulty

        return rewardRatio
    }

    breach(hostname) {
        if (this.ns.fileExists("BruteSSH.exe", "home")) {
            this.ns.brutessh(hostname);
        }

        if (this.ns.fileExists("FTPCrack.exe", "home")) {
            this.ns.ftpcrack(hostname);
        }

        if (this.ns.fileExists("FTPCrack.exe", "home")) {
            this.ns.ftpcrack(hostname);
        }

        if (this.ns.fileExists("HTTPWorm.exe", "home")) {
            this.ns.httpworm(hostname);
        }

        if (this.ns.fileExists("relaySMTP.exe", "home")) {
            this.ns.relaysmtp(hostname);
        }

        if (this.ns.fileExists("SQLInject.exe", "home")) {
            this.ns.sqlinject(hostname);
        }

        let serverDetails = this.ns.getServer(hostname)

        if (serverDetails.hasAdminRights) {
            return true
        }

        if (serverDetails.openPortCount >= serverDetails.numOpenPortsRequired) {
            this.ns.print("Rooting " + hostname)
            this.ns.nuke(hostname);
            return true
        } else {
            return false
        }
    }
}