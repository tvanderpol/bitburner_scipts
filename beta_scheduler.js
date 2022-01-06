/** @param {NS} ns **/

import DeployedScripts from "util/deployed_scripts.js"

// class Task {
//     constructor(script, runTime, threadCount, target) {
//         this.script = script
//         this.runTime = runTime
//         this.threadCount = threadCount
//         this.target = target
//     }
// }

class Target {
    constructor(ns, hostname) {
        this.ns = ns
        this.hostname = hostname
        this.details = this.ns.getServer(hostname)
        this.longestWeakenTime = this.ns.getWeakenTime(hostname)
        // needs to be long enough that whatever loop we run this in can validate the result 
        // before the next timeslot starts.
        this.timeSliceMs = 100
    }

    get minDifficulty() {
        return this.details.minDifficulty
    }
    get hackDifficulty() {
        return this.details.hackDifficulty
    }
    get moneyAvailable() {
        return this.details.moneyAvailable
    }
    get moneyMax() {
        return this.details.moneyMax
    }

    reserveNextTimeslotAfter(jobId, timestamp) {
        // should check if something is already ending that timeslot
        return new Map([
            ["startOn", timestamp],
            ["budgetMs", this.timeSliceMs]
        ])
    }

    validateTimeslots() {
        // once a timeslot has expired, check that the target is in fact still maximised
        // and delete the entry.
    }
}

class Host {
    constructor(ns, hostname) {
        this.ns = ns
        this.hostname = hostname
        this.details = ns.getServer(hostname)
        this.weakenTime = ns.getWeakenTime(hostname)
        this.growTime = ns.getGrowTime(hostname)
        this.hacktime = ns.getHackTime(hostname)
    }

    get coreCount() {
        return this.details.coreCount
    }

    get availableRam() {
        return this.details.maxRam - this.details.ramUsed
    }

    // needs to keep track of what's running, on which timeslot
}

class Job {
    constructor(ns, target) {
        this.ns = ns
        this.target = target
        this.id = crypto.randomUUID()
        this.tasks = new Set()
        ns.tprint("Job id [" + this.id + "]")
    }

    addTask(script, runTime, threadCount, target) {
        this.tasks.add(new Map([
            ["script", script],
            ["runTime", runTime],
            ["threadCount", threadCount]
        ]))
    }

    longestRuntime() {
        let runtimes = [...this.tasks].map(t => t.get("runTime"))
        return Math.max(...runtimes)
    }

    scheduleOn(host) {
        // needs to calculate the earliest it can finish based on longest task
        let earliestPossibleFinish = this.ns.getTimeSinceLastAug() + this.longestRuntime()
        // needs to acquire a timeslot from the Target
        let timeSlot = this.target.reserveNextTimeslotAfter(this.id, earliestPossibleFinish)

        return timeSlot
        // needs to exec the actual scripts with appropriate sleeps to land inside that timeslot
    }
}

class Scheduler {
    constructor(ns) {
        this.ns = ns
        this.ds = new DeployedScripts(ns)
        this.workpoolServers = ["home"]
        this.targetHostname = "n00dles"
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

    run() {
        for (const hostname of this.workpoolServers) {
            let host = new Host(this.ns, hostname)
            let target = new Target(this.ns, this.targetHostname)
            let job = new Job(this.ns, target)

            let minSecurityLevel = target.minDifficulty
            let currentSecurityLevel = target.hackDifficulty
            let securityGap = currentSecurityLevel - minSecurityLevel

            let moneyAvailable = target.moneyAvailable
            let moneyMax = target.moneyMax
            this.ns.tprint(`moneyAvailable: ${moneyAvailable} moneyMax: ${moneyMax}`)

            // Focus on weaken first
            if (securityGap > 0) {
                let weakenThreadsRequired = this.findWeakenThreadsForImpact(securityGap, host.coreCount)

                let totalWeakenRam = this.ds.weakenScriptRam * weakenThreadsRequired
                this.ns.tprint("securityGap: " + securityGap)
                this.ns.tprint("this.ds.weakenScriptRam: " + this.ds.weakenScriptRam)
                this.ns.tprint("weakenThreadsRequired: " + weakenThreadsRequired)
                this.ns.tprint("totalWeakenRam: " + totalWeakenRam)
                this.ns.tprint("availableRam: " + host.availableRam)
                this.ns.tprint("host.maxRam - host.ramUsed: " + `${host.maxRam} - ${host.ramUsed}`)

                if (totalWeakenRam <= host.availableRam) {
                    this.ns.tprint("All weaken workload fits in RAM")
                    job.addTask("weaken", ns.getWeakenTime(this.targetHostname), weakenThreadsRequired)
                    let remainingRam = host.availableRam - totalWeakenRam
                    this.ns.tprint("Still have " + remainingRam + " left over")
                }
                // Then get cash maxed
            } else if (moneyAvailable < moneyMax) {
                this.ns.tprint("moneyAvailable / moneyMax: " + (moneyAvailable / moneyMax))

                this.ns.tprint("moneyMax / moneyAvailable: " + (moneyMax / moneyAvailable))
                let desiredGrowthFactor = moneyMax / moneyAvailable

                let growThreadsRequired = Math.ceil(this.ns.growthAnalyze(this.targetHostname, desiredGrowthFactor, host.coreCount))
                job.addTask("grow", this.ns.getGrowTime(this.targetHostname), growThreadsRequired)

                let weakenThreadsRequired = this.findWeakenThreadsForImpact(this.ns.growthAnalyzeSecurity(growThreadsRequired), host.coreCount)
                job.addTask("weaken", this.ns.getWeakenTime(this.targetHostname), weakenThreadsRequired)

                this.ns.tprint(`growThreadsRequired: ${growThreadsRequired}`)
                this.ns.tprint(`weakenThreadsRequired: ${weakenThreadsRequired}`)
            }

            this.ns.tprint(`output from scheduleOn: ${job.scheduleOn(host)}`)
        }

    }
}


export async function main(ns) {
    let scheduler = new Scheduler(ns)
    scheduler.target = "n00dles"

    // while (true) {
    scheduler.run()
    //     await ns.sleep(50)
    // }



    // this thing has a port open to listen to job return values

    // If security < min, blast it until min
    // grow to 100% with enough weaken to counteract
    // hack as a nice manageable package of threads - small group that can be scheduled multiple times on the same host (due to job id)

    // Each job scheduled gets given an ID, will report back on complete
}