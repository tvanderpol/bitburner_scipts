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
        return this.accessibleServers.map(s => this.ns.getServer(s))
    }

    randomTarget() {
        return this.targets[Math.floor(Math.random() * this.targets.length)]
    }

    async deployScripts(server) {
        let targetHost = server.hostname
        if (!this.ns.fileExists(this.script, targetHost)) {
            await this.ns.scp(this.script, targetHost)
            this.ns.tprint("Want to copy " + this.script + " to " + targetHost)
        }
    }

    async runScripts(server) {
        let targetHost = server.hostname
        let availableRam = server.maxRam - server.ramUsed
        let threadCount = Math.floor(availableRam / this.scriptMemory)
        // this.ns.tprint("availableRam: " + availableRam)
        // this.ns.tprint("this.scriptMemory: " + this.scriptMemory)
        if (threadCount > 0) {
            let hackTarget = this.randomTarget().hostname
            this.ns.tprint("Hostname: " + hackTarget)
            this.ns.tprint("exec: " + [this.script, targetHost, threadCount, hackTarget])
            await this.ns.exec(this.script, targetHost, threadCount, hackTarget)
            this.messenger.queue("Starting " + targetHost + ":/" + this.script + " targetted at " + target, "info")
        }
    }

    usefulServers() {
        return this.allServers
            .filter(s => s.hostname != "home") // Dealing with scheduling home separately for now
            .filter(s => s.hasAdminRights)
            .filter(s => s.maxRam > 0)
    }

    async plan() {
        let usefulServers = this.usefulServers().splice(0, 3)
        usefulServers.forEach(async s => {
            await this.deployScripts(s).then(val => {
                this.runScripts(s)
            })
        })
        // this.ns.tprint("usefulServers count: " + usefulServers.length)
    }
}