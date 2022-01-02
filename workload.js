/** @param {NS} ns **/

export default class {
    constructor(ns, coreCount, threadCount, targetHostname) {
        this.ns = ns
        this.coreCount = coreCount
        this.threadCount = threadCount

        this.hackScript = "hack.js"
        this.hackScriptRam = ns.getScriptRam(this.hackScript)
        this.growScript = "grow.js"
        this.growScriptRam = ns.getScriptRam(this.growScript)
        this.weakenScript = "weaken.js"
        this.weakenScriptRam = ns.getScriptRam(this.weakenScript)

        this.targetHostname = targetHostname
        this.hackTarget = ns.getServer(targetHostname)
        this.timeToWeaken = ns.getWeakenTime(targetHostname)
        this.timeToGrow = ns.getGrowTime(targetHostname)
        this.timeToHack = ns.getHackTime(targetHostname)
        this.longestWait = Math.max(this.timeToWeaken, this.timeToGrow, this.timeToHack)
    }

    threadsToHack(targetPercentage) {
        let singleThreadFraction = this.ns.hackAnalyze(this.targetHostname)
        return Math.ceil(targetPercentage / singleThreadFraction)
    }

    findWeakenThreadsForImpact(desiredSecurityImpact) {
        let threadCount = 1
        let actualImpact = 0
        while (actualImpact < desiredSecurityImpact) {
            actualImpact = this.ns.weakenAnalyze(threadCount, this.ns.getServer().cpuCores)
            threadCount++
        }

        return threadCount
    }

    serverMaximised() {
        return this.hackTarget.moneyAvailable == this.hackTarget.moneyMax &&
            this.hackTarget.hackDifficulty == this.hackTarget.minDifficulty
    }

    newJob(script, threadCount, args) {
        return new Map([
            ["script", script],
            ["threadCount", threadCount],
            ["args", args],
        ])
    }

    boostJobs() {
        let threadsGrow = Math.floor(this.threadCount * 0.9)
        let threadsWeaken = this.threadCount - threadsGrow

        let growDelay = this.longestWait - this.timeToGrow + 5
        let weakenDelay = this.longestWait - this.timeToWeaken + 10

        // On very small memory machines it's possible only 1 thread can safely run so one of these will be 0:
        let jobs = []
        if(threadsGrow > 0) {
            jobs.push(this.newJob(this.growScript, threadsGrow, [this.targetHostname, growDelay]))
        }
        if(threadsWeaken > 0) {
            jobs.push(this.newJob(this.weakenScript, threadsWeaken, [this.targetHostname, weakenDelay]))
        }

        if(threadsGrow === 0 && threadsWeaken === 0) {
            this.ns.toast("Somehow ended up with a 0 thread job targetting " + this.targetHostname, "error")
        }

        return jobs
    }

    jobs() {
        if (this.serverMaximised()) {
            this.ns.tprint("Server " + this.targetHostname + " maximised!!!")
        } else {
            return this.boostJobs()
        }
    }
}