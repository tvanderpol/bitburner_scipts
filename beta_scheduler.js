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
        this.log = new Logger(ns, "Scheduler", true)
        this.workpoolServers = ["home"]
        this.targetHostname = "n00dles"
        this.log.info("boo")
    }

    set target(hostname) {
        this.targetHostname = hostname
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

    weakenTarget(securityGap, host, job) {
        let weakenThreadsRequired = this.findWeakenThreadsForImpact(securityGap, host.coreCount)

        let totalWeakenRam = this.ds.weakenScriptRam * weakenThreadsRequired
        this.log.dbg("securityGap: " + securityGap)
        this.log.dbg("this.ds.weakenScriptRam: " + this.ds.weakenScriptRam)
        this.log.dbg("weakenThreadsRequired: " + weakenThreadsRequired)
        this.log.dbg("totalWeakenRam: " + totalWeakenRam)
        this.log.dbg("availableRam: " + host.availableRam)

        if (totalWeakenRam <= host.availableRam) {
            this.log.dbg("All weaken workload fits in RAM")
            job.addTask("weaken", this.ns.getWeakenTime(this.targetHostname), weakenThreadsRequired)
            let remainingRam = host.availableRam - totalWeakenRam
            this.log.dbg("Still have " + remainingRam + " left over")
        } else {
            this.log.dbg("Can't do all the weakening in one hit - getting done what we can")
            let maxWeakenThreads = Math.floor(host.availableRam / this.ds.weakenScriptRam)
            job.addTask("weaken", this.ns.getWeakenTime(this.targetHostname), maxWeakenThreads)
        }
    }

    growTarget(moneyAvailable, moneyMax, host, job) {
        this.log.dbg("moneyAvailable / moneyMax: " + (moneyAvailable / moneyMax))

        this.log.dbg("moneyMax / moneyAvailable: " + (moneyMax / moneyAvailable))
        let desiredGrowthFactor = moneyMax / moneyAvailable

        let growThreadsRequired = Math.ceil(this.ns.growthAnalyze(this.targetHostname, desiredGrowthFactor, host.coreCount))
        job.addTask("grow", this.ns.getGrowTime(this.targetHostname), growThreadsRequired)

        let weakenThreadsRequired = this.findWeakenThreadsForImpact(this.ns.growthAnalyzeSecurity(growThreadsRequired), host.coreCount)
        job.addTask("weaken", this.ns.getWeakenTime(this.targetHostname), weakenThreadsRequired)

        this.log.dbg(`growThreadsRequired: ${growThreadsRequired}`)
        this.log.dbg(`weakenThreadsRequired: ${weakenThreadsRequired}`)
    }

    async run() {
        for (const hostname of this.workpoolServers) {
            let host = new Host(this.ns, hostname)
            let target = new Target(this.ns, this.targetHostname)
            let job = new Job(this.ns, target)

            let minSecurityLevel = target.minDifficulty
            let currentSecurityLevel = target.hackDifficulty
            let securityGap = currentSecurityLevel - minSecurityLevel

            let moneyAvailable = target.moneyAvailable
            let moneyMax = target.moneyMax
            this.log.dbg(`moneyAvailable: ${moneyAvailable} moneyMax: ${moneyMax}`)

            if (securityGap > 0) {
                this.weakenTarget(securityGap, host, job)
            } else if (moneyAvailable < moneyMax) {
                this.growTarget(moneyAvailable, moneyMax, host, job)
            } else {
                this.log.dbg(`Server is maximised, time to throw hacks at it`)
            }

            let output = await job.scheduleOn(host)
            this.log.dbg(`output from scheduleOn: ${output}`)
        }
    }
}


export async function main(ns) {
    let scheduler = new Scheduler(ns)
    // scheduler.target = "n00dles"
    scheduler.target = "rho-construction"

    // while (true) {
    await scheduler.run()
    //     await ns.sleep(50)
    // }



    // this thing has a port open to listen to job return values

    // If security < min, blast it until min
    // grow to 100% with enough weaken to counteract
    // hack as a nice manageable package of threads - small group that can be scheduled multiple times on the same host (due to job id)

    // Each job scheduled gets given an ID, will report back on complete
}