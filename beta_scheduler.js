/** @param {NS} ns **/

import Host from "scheduler/host.js"
import Job from "scheduler/job.js"
import Target from "scheduler/target.js"
import DeployedScripts from "util/deployed_scripts.js"
import Logger from "util/logger.js"

class Scheduler {
    constructor(ns) {
        this.ns = ns
        this.ds = new DeployedScripts(ns)
        this.minimumRamOnHost = this.ds.weakenScriptRam + this.ds.growScriptRam
        this.log = new Logger(ns, "Scheduler", false)
        // this.workpoolServers = ["home", "pserv-0"]
        this.workpoolServers = ["home"].concat(this.ns.getPurchasedServers())
        this.targetHostname = ""
        this.log.info(`Scheduler started. WorkPool [${this.workpoolServers}] (min ram ${this.minimumRamOnHost}GB)`)
    }

    set target(hostname) {
        this.log.info(`Target set to ${hostname}`)
        this.targetHostname = hostname
        this.targetObject = new Target(this.ns, hostname)
    }

    get target() {
        return this.targetObject
    }

    async prepareServers() {
        for (const host of this.workpoolServers) {
            if ("home" != host) { // We develop here, let's not get things confused.
                let deployableFiles = this.ns.ls("home", "deploy/")
                for (const file of deployableFiles) {
                    this.log.dbg(`scp home:/${file} ${host}:/${file}`)
                    await this.ns.scp(file, "home", host)
                }
            }
        }
    }

    findWeakenThreadsForImpact(desiredSecurityImpact, coreCount) {
        let threadCount = 1
        let actualImpact = 0
        while (actualImpact < desiredSecurityImpact) {
            actualImpact = this.ns.weakenAnalyze(threadCount, coreCount)
            threadCount++
        }

        return threadCount
    }

    weakenTarget(target, host, job, projectedDifficulty, executeAfter) {
        let securityGap = projectedDifficulty - target.minDifficulty
        let weakenThreadsRequired = this.findWeakenThreadsForImpact(securityGap, host.coreCount)

        let totalWeakenRam = this.ds.weakenScriptRam * weakenThreadsRequired
        this.log.dbg("securityGap: " + securityGap)
        this.log.dbg("executeAfter: " + executeAfter)
        this.log.dbg("projectedDifficulty: " + projectedDifficulty)
        this.log.dbg("this.ds.weakenScriptRam: " + this.ds.weakenScriptRam)
        this.log.dbg("weakenThreadsRequired: " + weakenThreadsRequired)
        this.log.dbg("totalWeakenRam: " + totalWeakenRam)
        this.log.dbg("availableRam: " + host.availableRam)

        job.executeAfter = executeAfter

        if (totalWeakenRam <= host.availableRam) {
            this.log.info("All weaken workload fits in RAM")
            job.addTask("weaken", this.ns.getWeakenTime(this.targetHostname), weakenThreadsRequired)
            return target.minDifficulty
        } else {
            this.log.info("Can't do all the weakening in one hit - getting done what we can")
            let maxWeakenThreads = Math.floor(host.availableRam / this.ds.weakenScriptRam)
            job.addTask("weaken", this.ns.getWeakenTime(this.targetHostname), maxWeakenThreads)
            return projectedDifficulty - (maxWeakenThreads * 0.05)
        }
    }

    growUsingRam(coreCount, availableRam) {
        let proposedGrowthThreads = 1
        let proposedWeakenThreads = 1
        let proposedRamCost = this.ramRequiredFor(proposedGrowthThreads, proposedWeakenThreads)

        if (proposedRamCost > availableRam) {
            // We can't fit any useful workload, bail!
            return [0, 0]
        }

        let maxAttempts = 0
        let growthThreads, weakenThreads
        // TODO: some caching here, or some smarter way of finding the right amount of threads?
        // while (proposedRamCost < availableRam && maxAttempts < 60) {
        while (proposedRamCost < availableRam) {
            growthThreads = proposedGrowthThreads
            weakenThreads = proposedWeakenThreads
            proposedGrowthThreads += 1
            proposedWeakenThreads = this.findWeakenThreadsForImpact(this.ns.growthAnalyzeSecurity(proposedGrowthThreads), coreCount)

            proposedRamCost = this.ramRequiredFor(proposedGrowthThreads, proposedWeakenThreads)
            // this.log.dbg(`Proposing growth[${proposedGrowthThreads}] / weaken[${proposedWeakenThreads}] (${proposedRamCost}GB)`)

            maxAttempts += 1
        }

        return [weakenThreads, growthThreads]
    }

    growTarget(moneyAvailable, moneyMax, host, job) {
        this.log.dbg("moneyMax / moneyAvailable: " + (moneyMax / moneyAvailable))
        let desiredGrowthFactor = moneyMax / moneyAvailable
        let growThreadsRequired = Math.ceil(this.ns.growthAnalyze(this.targetHostname, desiredGrowthFactor, host.coreCount))
        let weakenThreadsRequired = this.findWeakenThreadsForImpact(this.ns.growthAnalyzeSecurity(growThreadsRequired), host.coreCount)
        let totalRamRequired = this.ramRequiredFor(growThreadsRequired, weakenThreadsRequired)
        this.log.dbg(`growThreadsRequired: ${growThreadsRequired}`)
        this.log.dbg(`weakenThreadsRequired: ${weakenThreadsRequired}`)
        this.log.dbg(`Total ram required: ${totalRamRequired}`)

        if (totalRamRequired <= host.availableRam) {
            this.log.info(`[${host.name}] All grow workload fits in RAM`)
            job.addTask("grow", this.ns.getGrowTime(this.targetHostname), growThreadsRequired)
            job.addTask("weaken", this.ns.getWeakenTime(this.targetHostname), weakenThreadsRequired)
            return true
        } else {
            this.log.info(`[${host.name}] Can't do all grow calls in one go, splitting it (${host.availableRam.toFixed(3)}GB available)`)
            let weakenThreads, growthThreads
            [weakenThreads, growthThreads] = this.growUsingRam(host.coreCount, host.availableRam)
            job.addTask("grow", this.ns.getGrowTime(this.targetHostname), growthThreads)
            job.addTask("weaken", this.ns.getWeakenTime(this.targetHostname), weakenThreads)
            return false
        }
    }

    ramRequiredFor(growThreads = 0, weakenThreads = 0, hackThreads = 0) {
        return growThreads * this.ds.growScriptRam +
            weakenThreads * this.ds.weakenScriptRam +
            hackThreads * this.ds.hackScriptRam
    }

    threadsToHack(target, targetPercentage) {
        let singleThreadFraction = this.ns.hackAnalyze(target)
        return Math.ceil(targetPercentage / singleThreadFraction)
    }

    calculateGrowthFactor(moneyMax, moneyAvailable, actualPercentage) {
        let newBalance = moneyAvailable - (moneyAvailable * actualPercentage)

        // newBalance * factor = moneyMax
        return moneyMax / newBalance
    }

    hackTarget(target, host, job) {
        // For now let's schedule to steal 1%. If that doesn't fit in the host RAM, let's just warn and move on.
        let hackThreads = this.threadsToHack(target.name, 0.01)
        let hackSecurityImpact = this.ns.hackAnalyzeSecurity(hackThreads)
        let weakenThreadsForHack = this.findWeakenThreadsForImpact(hackSecurityImpact, host.coreCount)

        this.log.dbg(`Threads to hack 1%: ${hackThreads}`)

        let actualPercentage = hackThreads * this.ns.hackAnalyze(target.name)
        let growthFactor = this.calculateGrowthFactor(target.moneyMax, target.moneyAvailable, actualPercentage)
        let growthThreads = Math.ceil(this.ns.growthAnalyze(target.name, growthFactor, host.cpuCores))
        let growSecurityImpact = this.ns.growthAnalyzeSecurity(growthThreads)
        let weakenThreadsForGrow = this.findWeakenThreadsForImpact(growSecurityImpact, host.coreCount)

        let totalRamNeeded = this.ramRequiredFor(growthThreads, weakenThreadsForHack + weakenThreadsForGrow, hackThreads)

        if (host.availableRam < totalRamNeeded) {
            this.log.info(`Host ${host.name} doesn't have the free ${totalRamNeeded}GB ram for a 1% pluck on ${target.name}, skipping for now.`)
        } else {
            job.addTask("hack", this.ns.getHackTime(target.name), hackThreads)
            job.addTask("weaken", this.ns.getWeakenTime(target.name), weakenThreadsForHack)
            job.addTask("grow", this.ns.getGrowTime(target.name), growthThreads)
            job.addTask("weaken", this.ns.getWeakenTime(target.name), weakenThreadsForGrow)
        }
    }

    async run() {
        this.target.updateDetails()
        for (const hostname of this.workpoolServers) {
            this.log.info(`Checking schedule for ${hostname}`)
            let host = new Host(this.ns, hostname)
            if (host.availableRam < this.minimumRamOnHost) {
                // this.log.dbg(`${hostname} has no useful ram available`)
                continue
            } else {
                this.log.info(`${hostname} has ${host.availableRam}GB to play with, let's go.`)
            }
            let job = new Job(this.ns, this.target)

            let moneyAvailable = this.target.moneyAvailable
            let moneyMax = this.target.moneyMax
            this.log.dbg(`moneyAvailable: ${moneyAvailable} moneyMax: ${moneyMax}`)

            let futureHackDifficulty = this.target.hackDifficulty
            let futureMoneyMax = (this.target.moneyAvailable === this.target.moneyMax)

            let [projectedChangeTime, projectedHackDifficulty] = this.target.projectedHackDifficulty

            this.log.dbg(`Checking if weaken is needed: projectedHackDifficulty > this.target.minDifficulty: ${projectedHackDifficulty} > ${this.target.minDifficulty}`)

            if (projectedHackDifficulty > this.target.minDifficulty) {
                futureHackDifficulty = this.weakenTarget(this.target, host, job, projectedHackDifficulty, projectedChangeTime)
            } else if (moneyAvailable < moneyMax) {
                futureMoneyMax = this.growTarget(moneyAvailable, moneyMax, host, job)
            } else {
                this.log.dbg(`Server is maximised, time to throw hacks at it`)
                futureMoneyMax = true
                this.hackTarget(this.target, host, job)
            }

            let output = await job.scheduleOn(host)
            if (output.length > 0 && -1 != output.findIndex(e => e === 0)) {
                this.log.warn(`One of the jobs failed to schedule for job[${job.id}]`)
            } else {
                this.log.dbg(`output from scheduleOn: ${output}`)
            }

            if (futureHackDifficulty != this.target.hackDifficulty) {
                this.log.info(`We're going to change hack difficulty in the future, changing projection.`)
                this.log.dbg(`updateHackDifficultyProjection(job.finishTime, futureHackDifficulty): (updateHackDifficultyProjection(${job.finishTime}, ${futureHackDifficulty}))`)
                this.target.updateHackDifficultyProjection(job.finishTime, futureHackDifficulty)
            }
            if (!(this.target.moneyAvailable == this.target.moneyMax) && futureMoneyMax) {
                this.target.setFutureMoneyMax(job.finishTime, futureMoneyMax)
            }
        }
    }
}


export async function main(ns) {
    ns.disableLog("ALL")
    let scheduler = new Scheduler(ns)
    // scheduler.target = "n00dles"
    scheduler.target = "omega-net"
    await scheduler.prepareServers()

    let serverMaximised = false

    while (!serverMaximised) {
        serverMaximised = await scheduler.run()
        // await ns.sleep(50)
        await ns.sleep(1000)
    }



    // this thing has a port open to listen to job return values

    // If security < min, blast it until min
    // grow to 100% with enough weaken to counteract
    // hack as a nice manageable package of threads - small group that can be scheduled multiple times on the same host (due to job id)

    // Each job scheduled gets given an ID, will report back on complete
}