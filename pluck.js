/** @param {NS} ns **/

const DEFAULT_PERCENTAGE_TO_TAKE = 0.30

const HACK_SCRIPT = "hack.js"
const GROW_SCRIPT = "grow.js"
const WEAKEN_SCRIPT = "weaken.js"
let hackWeight;
let growWeight;
let weakenWeight;

function percentage(progress, max) {
    return Math.round((progress / max) * 100)
}

// let currentReportCount = reportEvery;

function reportProgress(ns, server) {
    let percentageComplete = percentage(server.moneyAvailable, server.moneyMax)
    ns.toast("[" + server.hostname + "] " + percentageComplete + "% of " + server.moneyMax + " (diff: " + server.hackDifficulty + "/" + server.minDifficulty + ")", "info")
}

function serverMaximised(server) {
    return server.moneyAvailable == server.moneyMax &&
        server.hackDifficulty == server.minDifficulty
}

function debugPrintTarget(ns, target) {
    let server = ns.getServer(target)
    ns.tprint("server.moneyAvailable: " + server.moneyAvailable)
    ns.tprint("server.moneyMax: " + server.moneyMax)
    ns.tprint("server.hackDifficulty: " + server.hackDifficulty)
    ns.tprint("server.minDifficulty: " + server.minDifficulty)
    ns.tprint("Money check: " + server.moneyAvailable == server.moneyMax)
    ns.tprint("Hack check: " + server.hackDifficulty == server.minDifficulty)
    ns.tprint("serverMaximised(server): " + serverMaximised(server))
}

function threadsToHack(ns, target, targetPercentage) {
    let singleThreadFraction = ns.hackAnalyze(target)
    return Math.ceil(targetPercentage / singleThreadFraction)
}

function findWeakenThreadsForImpact(ns, desiredSecurityImpact) {
    let threadCount = 1
    let actualImpact = 0
    while (actualImpact < desiredSecurityImpact) {
        actualImpact = ns.weakenAnalyze(threadCount, ns.getServer().cpuCores)
        threadCount++
    }

    return threadCount
}

function calculateGrowthFactor(moneyMax, moneyAvailable, actualPercentage) {
    let newBalance = moneyAvailable - (moneyAvailable * actualPercentage)

    // newBalance * factor = moneyMax
    return moneyMax / newBalance
}

async function boostTarget(ns, target) {
    ns.toast("Fixing " + target + " up for the plucking", "info")
    let host = ns.getServer()

    let timeToWeaken = ns.getWeakenTime(target)
    let timeToGrow = ns.getGrowTime(target)
    let longestWait = Math.max(timeToWeaken, timeToGrow)

    let threadBudget = (host.maxRam - host.ramUsed) / growWeight;

    ns.print("growWeight: " + growWeight)
    ns.print("threadBudget: " + threadBudget)

    let threadsGrow = Math.floor(threadBudget * 0.9)
    let threadsWeaken = Math.floor(threadBudget * 0.1)

    let growDelay = longestWait - timeToGrow + 5
    let weakenDelay = longestWait - timeToWeaken + 10
    await ns.run("grow.js", threadsGrow, target, growDelay)
    await ns.run("weaken.js", threadsWeaken, target, weakenDelay)
    await ns.sleep(longestWait + 2000)
}

async function getMoney(ns, target, percentageToTake) {
    let server = ns.getServer(target)
    let host = ns.getServer()

    let timeToWeaken = ns.getWeakenTime(target)
    let timeToGrow = ns.getGrowTime(target)
    let timeToHack = ns.getHackTime(target)
    let longestWait = Math.max(timeToWeaken, timeToGrow, timeToHack)

    ns.print("timeToWeaken: " + timeToWeaken);
    ns.print("timeToGrow: " + timeToGrow);
    ns.print("timeToHack: " + timeToHack);
    ns.print("longestWait: " + longestWait);

    let threadsHack = threadsToHack(ns, target, percentageToTake)
    let actualPercentage = threadsHack * ns.hackAnalyze(target)
    let dollarAmount = Math.round(actualPercentage * server.moneyAvailable)

    ns.print("threadsHack: " + threadsHack);
    ns.print("actualPercentage: " + actualPercentage)

    let growthFactor = calculateGrowthFactor(server.moneyMax, server.moneyAvailable, actualPercentage)
    let threadsGrow = Math.ceil(ns.growthAnalyze(target, growthFactor, host.cpuCores) * 1.05)
    let securityImpact = ns.growthAnalyzeSecurity(threadsGrow) + ns.hackAnalyzeSecurity(threadsHack)

    ns.print("threadsGrow: " + threadsGrow)
    ns.print("securityImpact: " + securityImpact)

    let threadsWeaken = findWeakenThreadsForImpact(ns, securityImpact)

    ns.print("threadsWeaken: " + threadsWeaken)

    ns.toast("Going to grab $" + dollarAmount + " from " + target, "success")

    let hackDelay = longestWait - timeToHack
    let growDelay = longestWait - timeToGrow
    let weakenDelay = longestWait - timeToWeaken
    await ns.run("hack.js", threadsHack, target, hackDelay)
    await ns.run("weaken.js", threadsWeaken, target, weakenDelay + 5)
    await ns.run("grow.js", threadsGrow, target, growDelay + 10)
    await ns.run("weaken.js", threadsWeaken, target, weakenDelay + 15)
    await ns.sleep(longestWait + 2000)
}

export async function main(ns) {
    ns.disableLog("getServerMoneyAvailable")
    ns.disableLog("sleep")


    let target;
    let percentageToTake = DEFAULT_PERCENTAGE_TO_TAKE
    hackWeight = ns.getScriptRam(HACK_SCRIPT)
    growWeight = ns.getScriptRam(GROW_SCRIPT)
    weakenWeight = ns.getScriptRam(WEAKEN_SCRIPT)

    if( hackWeight != growWeight != weakenWeight) {
        ns.print("Danger! Scripts have uneven RAM impact")
    }

    if (ns.args.length == 0) {
        ns.tprint("Please supply a target as the first argument")
        ns.exit()
    } else {
        target = ns.args[0]
        if (ns.args.length == 2) {
            percentageToTake = ns.args[1]
        }
    }

    ns.toast("PLUCK: Engaged on " + target + " to robinhood " + Math.round(percentageToTake * 100) + "%", "info")

    while (true) {
        let server = ns.getServer(target)
        if (!serverMaximised(server)) {
            ns.print("Server " + target + " not maximised, smashing it.");
            await boostTarget(ns, target);
        } else {
            ns.print("Server " + target + " ripe, plucking it.");
            await getMoney(ns, target, percentageToTake);
        }
        await ns.sleep(50)
    }
}