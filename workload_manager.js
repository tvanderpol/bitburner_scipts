/** @param {NS} ns **/

import Workload from "workload.js"

export default class {
    constructor(ns, messenger) {
        this.ns = ns
        this.messenger = messenger
        this.accessibleServers = []
        this.targets = []
        this.hackScript = "hack.js"
        this.growScript = "grow.js"
        this.growScriptRam = ns.getScriptRam(this.growScript)
        this.weakenScript = "weaken.js"
        this.scriptsToDeploy = [this.hackScript, this.growScript, this.weakenScript]
        this.currentTarget = null
        this.lastTargetChange = null

        // Always have this.ns.getTimeSinceLastAug() - this.lastTargetChange be at least 10 minutes - no point not picking any targets straight away. 
        this.minimumExploitTime = 10 * 60_000
    }

    set botnet(hostList) {
        this.accessibleServers = hostList
    }

    set targetList(targets) {
        this.targets = targets
    }

    get allServers() {
        // TODO: For some reason, newly bought purchasedServers don't show up in the network scanner until script reset
        // That is annoying and not very hands off so I force-add them here.
        //
        // There's probably a bug that needs fixing
        let purchasedServers = this.ns.getPurchasedServers()
        let botnetHosts = this.accessibleServers.map(s => s.hostname)
        let allHosts = [...new Set(purchasedServers.concat(botnetHosts))]
        return allHosts.map(h => this.ns.getServer(h))
    }

    get maxGlobalGrowThreads() {
        let totalRam = this.accessibleServers
            .map(s => s.maxRam)
            .reduce((acc, next) => acc + next, 0)
        return totalRam / this.growScriptRam
    }

    fitsInGlobalRam(server) {
        // a heuristic - can we grow this thing by at least 40% or so with all threads available to us?
        // if not, this isn't going to be viable.
        //
        // I hardcoded the core count as it's just a guideline, I don't care about the precise number here.
        let growthThreadsRequired = this.ns.growthAnalyze(server.hostname, 1.2, 1)
        return growthThreadsRequired <= this.maxGlobalGrowThreads
    }

    bestTarget() {
        // this.ns.tprint("These fit in global ram: " + this.targets.filter(s => this.fitsInGlobalRam(s)).map(s => s.hostname))
        return this.targets.filter(s => this.fitsInGlobalRam(s))[0]
    }

    timeToExploit(server) {
        // We should have had at least several weaken cycles:
        return this.ns.getWeakenTime(this.currentTarget.hostname) * 20
    }

    hackTarget() {
        if (this.currentTarget == null) {
            this.currentTarget = this.bestTarget()
            this.lastTargetChange = this.ns.getTimeSinceLastAug()
            this.messenger.queue("Targetting " + this.currentTarget.hostname, "success")
        } else if (this.bestTarget().hostname != this.currentTarget.hostname) {
            // this.ns.print("New best target, checking how long we been at this.")

            if (this.ns.getTimeSinceLastAug() - this.lastTargetChange + this.minimumExploitTime > this.timeToExploit(this.currentTarget)) {
                this.messenger.queue("Switching targets from " + this.currentTarget.hostname + " to " + this.bestTarget().hostname + " as it's been a minute", "info")
                this.currentTarget = this.bestTarget()
            } else {
                // this.ns.print("Haven't gotten our money's worth from currentTarget yet, switching later")
            }
        }
        return this.currentTarget
    }

    async deployScriptsOn(server) {
        for (const script of this.scriptsToDeploy) {
            if (!this.ns.fileExists(script, server.hostname)) {
                this.messenger.queue("Deploying " + server.hostname + ":/" + script)
                await this.ns.scp(script, server.hostname)
            }
        }
    }

    async runScriptsOn(server) {
        let targetHost = server.hostname
        let availableRam = server.maxRam - server.ramUsed
        // TODO: This might need to account for potentially different weights of those scripts?
        let threadCount = Math.floor(availableRam / this.growScriptRam)

        if (threadCount > 0) {
            await this.useThreads(targetHost, threadCount)
        }
    }

    async useThreads(targetHost, threadCount) {
        let hackTarget = this.hackTarget().hostname
        let workload = new Workload(this.ns, this.messenger, targetHost.cpuCores, threadCount, hackTarget)
        for (const job of workload.jobs()) {
            // this.messenger.queue("Starting " + targetHost + ":/" + job.get("script") + "[" + job.get("threadCount") + "] targetted at " + hackTarget, "info")
            await this.ns.exec(job.get("script"), targetHost, job.get("threadCount"), hackTarget, job.get("delay"))
        }
    }

    clearSlate() {
        for(const server of this.usefulServers()) {
            this.messenger.queue("Killing all scripts on " + server.hostname)
            this.ns.killall(server.hostname)
        }
    }

    usefulServers() {
        return this.allServers
            .filter(s => s.hostname != "home") // Dealing with scheduling home separately for now
            .filter(s => s.hasAdminRights)
            .filter(s => s.maxRam > 0)
    }

    async plan() {
        for (let server of this.usefulServers()) {
            await this.deployScriptsOn(server)
            await this.runScriptsOn(server)
        }
    }
}