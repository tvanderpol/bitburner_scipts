/** @param {NS} ns **/

export default class {
    constructor(ns, messenger, coreCount, threadCount, targetHostname) {
        this.ns = ns
        this.messenger = messenger
        this.targetPercentage = 0.1
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

    newJob(script, threadCount, delay) {
        return new Map([
            ["script", script],
            ["threadCount", threadCount],
            ["delay", delay],
        ])
    }

    calculateGrowthFactor(moneyMax, moneyAvailable, actualPercentage) {
        let newBalance = moneyAvailable - (moneyAvailable * actualPercentage)

        // newBalance * factor = moneyMax
        return moneyMax / newBalance
    }

    findWeakenThreadsForImpact(desiredSecurityImpact) {
        let threadCount = 1
        let actualImpact = 0
        while (actualImpact < desiredSecurityImpact) {
            actualImpact = this.ns.weakenAnalyze(threadCount, this.coreCount)
            threadCount++
        }

        return threadCount
    }

    boostJobs() {
        // Prioritise weakening until we're at minDifficulty
        let growMultiplier = 0.1
        if (this.hackTarget.hackDifficulty == this.hackTarget.minDifficulty) {
            growMultiplier = 0.9
        }
        let threadsGrow = Math.floor(this.threadCount * growMultiplier)
        let threadsWeaken = this.threadCount - threadsGrow

        let growDelay = this.longestWait - this.timeToGrow + 5
        let weakenDelay = this.longestWait - this.timeToWeaken + 10

        // On very small memory machines it's possible only 1 thread can safely run so one of these will be 0:
        let jobs = []
        if (threadsGrow > 0) {
            jobs.push(this.newJob(this.growScript, threadsGrow, growDelay))
        }
        if (threadsWeaken > 0) {
            jobs.push(this.newJob(this.weakenScript, threadsWeaken, weakenDelay))
        }

        if (threadsGrow === 0 && threadsWeaken === 0) {
            this.ns.toast("Somehow ended up with a 0 thread job targetting " + this.targetHostname, "error")
        }

        return jobs
    }

    pluckJobs() {
        let threadsHack = this.threadsToHack(this.targetPercentage)
        let actualPercentage = threadsHack * this.ns.hackAnalyze(this.targetHostname)

        let growthFactor = this.calculateGrowthFactor(this.hackTarget.moneyMax, this.hackTarget.moneyAvailable, actualPercentage)
        let threadsGrow = Math.ceil(this.ns.growthAnalyze(this.targetHostname, growthFactor, this.coreCount) * 1.05)
        let hackSecurityImpact = this.ns.hackAnalyzeSecurity(threadsHack)
        let growthSecurityImpact = this.ns.growthAnalyzeSecurity(threadsGrow)

        let threadsWeakenCounterHack = this.findWeakenThreadsForImpact(hackSecurityImpact)
        let threadsWeakenCounterGrowth = this.findWeakenThreadsForImpact(growthSecurityImpact)

        this.ns.tprint("this.longestWait - this.timeToHack: " + this.longestWait + this.timeToHack)
        let hackDelay = this.longestWait - this.timeToHack
        let growDelay = this.longestWait - this.timeToGrow
        let weakenDelay = this.longestWait - this.timeToWeaken

        let totalRequiredThreads = threadsHack + threadsGrow + threadsWeaken * 2

        if(this.threadCount < totalRequiredThreads) {
            this.messenger.queue("Tried to schedule a pluck targeting " + this.targetHostname + " on too small a host - a gentle reminder to make this bit smarter.")
            // return this.boostJobs()
            return [
                this.newJob(this.hackScript, this.threadCount, 0),
            ]
        } else {
            return [
                this.newJob(this.hackScript, threadsHack, hackDelay),
                this.newJob(this.weakenScript, threadsWeakenCounterHack, weakenDelay + 5),
                this.newJob(this.growScript, threadsGrow, growDelay + 10),
                this.newJob(this.weakenScript, threadsWeakenCounterGrowth, weakenDelay + 15),
            ]
        }
    }

    jobs() {
        if (this.serverMaximised()) {
            return this.pluckJobs()
        } else {
            return this.boostJobs()
        }
    }
}