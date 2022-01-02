/** @param {NS} ns **/

import Workload from "workload.js"

export default class {
    constructor(ns, messenger) {
        this.ns = ns
        this.messenger = messenger
        this.accessibleServers = []
        this.targets = []
        this.script = "simple_hack.script"
        this.scriptMemory = this.ns.getScriptRam(this.script)
        this.hackScript = "hack.js"
        this.growScript = "grow.js"
        this.growScriptRam = ns.getScriptRam(this.growScript)
        this.weakenScript = "weaken.js"
        this.scriptsToDeploy = [this.script, this.hackScript, this.growScript, this.weakenScript]
        this.currentTarget = null
        this.lastTargetChange = null
    }

    set botnet(hostList) {
        this.accessibleServers = hostList
    }

    set targetList(targets) {
        this.targets = targets
    }

    get allServers() {
        return this.accessibleServers
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
        let growthThreadsRequired = this.ns.growthAnalyze(server.hostname, 1.4, 1)
        return growthThreadsRequired <= this.maxGlobalGrowThreads
    }

    bestTarget() {
        return this.targets.filter( s=> this.fitsInGlobalRam(s))[0]
    }

    hackTarget() {
        if (this.currentTarget == null) {
            this.currentTarget = this.bestTarget()
            this.lastTargetChange = this.ns.getTimeSinceLastAug()
        } else if (this.bestTarget() != this.currentTarget) {
            // this.ns.print("New best target, checking how long we been at this.")
            if (this.ns.getTimeSinceLastAug() - this.lastTargetChange > 300_000) { // TODO: This should probably be something a multiple of weaken time or something
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
                await this.ns.scp(script, server.hostname)
            }
        }
    }

    async runScriptsOn(server) {
        let targetHost = server.hostname
        let availableRam = server.maxRam - server.ramUsed
        let threadCount = Math.floor(availableRam / this.scriptMemory)

        if (threadCount > 0) {
            await this.useThreads(targetHost, threadCount)
        }
    }

    async useThreads(targetHost, threadCount) {
        let hackTarget = this.hackTarget().hostname
        let workload = new Workload(this.ns, targetHost.cpuCores, threadCount, hackTarget)
        for(const job of workload.jobs()) {
            this.messenger.queue("Starting " + targetHost + ":/" + job.get("script") + "[" + job.get("threadCount") + "] targetted at " + hackTarget, "info")
            await this.ns.exec(job.get("script"), targetHost, job.get("threadCount"), hackTarget)
        }
    }

    usefulServers() {
        return this.allServers
            .filter(s => s.hostname != "home") // Dealing with scheduling home separately for now
            .filter(s => s.hasAdminRights)
            .filter(s => s.maxRam > 0)
    }

    async plan() {
        let usefulServers = this.usefulServers()
        for (let server of usefulServers) {
            await this.deployScriptsOn(server)
            await this.runScriptsOn(server)
        }
    }
}