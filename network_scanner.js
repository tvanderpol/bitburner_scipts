import Target from "scheduler/target.js"

/** @param {NS} ns **/
export default class {
    constructor(ns, messenger) {
        this.ns = ns
        this.messenger = messenger
        this.timeFactor = 0.05 // Weakentime can't be more than this percentage of timeSinceLastAug
        this.serverList = new Map()
    }

    get allServerHostnames() {
        let hostnames = []
        this.serverList.forEach((_, hostname) => hostnames.push(hostname))
        return hostnames
    }

    get allRootedServers() {
        return this.allServerHostnames
            .map(s => this.ns.getServer(s))
            .filter(s => s.hasAdminRights)
    }

    meetsTimeFactor(server) {
        let weakenTime = this.ns.getWeakenTime(server.hostname)
        return weakenTime / this.ns.getTimeSinceLastAug() < this.timeFactor
    }

    currentTargetList(targetCount = 15) {
        return this.allServerHostnames
            .map(s => new Target(this.ns, s))
            .filter(t => t.isValidTarget)
            .sort((a, b) => b.score - a.score)
            .slice(0, targetCount)
    }

    minSecurityTargetList(targetCount = 5) {
        return this.allServerHostnames
            .map(s => new Target(this.ns, s))
            .filter(t => t.isValidTarget)
            .filter(t => t.finishedWeakening)
            .sort((a, b) => { this.ns.tprint(`comparing ${a.hostname}[${a.score}] to ${b.hostname}[${b.score}] for`); b.score - a.score })
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

    findPath(hostname) {
        this.mapServers()
        if (this.serverList.has(hostname)) {
            let serverEntry = this.serverList.get(hostname)
            let nodePath = [serverEntry.parent.hostname, serverEntry.hostname]
            let parent = serverEntry.parent
            let depth = 0
            while (parent.hostname != "home" || depth > 20) {
                depth += 1
                parent = parent.parent
                nodePath.unshift(parent.hostname)
            }
            return nodePath
        } else {
            return "No server by that name!"
        }

    }
}