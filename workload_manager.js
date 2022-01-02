/** @param {NS} ns **/

export const MONEY_FMT = '($0.000a)'
export const NUM_FMT = '0.000a'

export default class {
    constructor(ns, messenger) {
        this.ns = ns
        this.messenger = messenger
        this.accessibleServers = []
        this.targets = []
        this.script = "simple_hack.script"
        this.scriptMemory = ns.getScriptRam(this.script)
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

    hackTarget() {
        // return this.targets[Math.floor(Math.random() * this.targets.length)]
        return this.targets[0]
    }

    async deployScriptsOn(server) {
        if (!this.ns.fileExists(this.script, server.hostname)) {
            await this.ns.scp(this.script, server.hostname)
        }
    }

    async runScriptsOn(server) {
        let targetHost = server.hostname
        let availableRam = server.maxRam - server.ramUsed
        let threadCount = Math.floor(availableRam / this.scriptMemory)
        // this.ns.tprint("availableRam: " + availableRam)
        // this.ns.tprint("this.scriptMemory: " + this.scriptMemory)
        if (threadCount > 0) {
            let hackTarget = this.hackTarget().hostname
            this.ns.print("exec: " + [this.script, targetHost, threadCount, hackTarget])
            this.messenger.queue("Starting " + targetHost + ":/" + this.script + " targetted at " + hackTarget, "info")
            await this.ns.exec(this.script, targetHost, threadCount, hackTarget)
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