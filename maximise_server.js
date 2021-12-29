/** @param {NS} ns **/

function serverMaximised(server) {
    return server.moneyAvailable == server.moneyMax &&
        server.hackDifficulty == server.minDifficulty
}

function calculateGrowThreadCount(availableLocalRam, weakenRamCost, weakenCallsRequired, growRamCost) {
    let remainingRam = availableLocalRam - (weakenCallsRequired * weakenRamCost)
    return Math.floor(remainingRam / growRamCost)
}

export async function main(ns) {    
    let target;
    let growRamCost = ns.getScriptRam("grow.js")
    let weakenRamCost = ns.getScriptRam("weaken.js")

    if (ns.args.length == 0) {
        ns.tprint("Please supply a target as the first argument")
        ns.exit()
    } else {
        target = ns.args[0]
    }


    let weakenTime = ns.getWeakenTime(target)
    ns.tprint("Going to maximise " + target);

    while (!serverMaximised(ns.getServer(target))) {
        let server = ns.getServer(target)
        let localhost = ns.getServer()

        let availableLocalRam = localhost.maxRam - localhost.ramUsed
        ns.tprint("localhost ram available: " + availableLocalRam)

        if (availableLocalRam < weakenRamCost) {
            ns.tprint("Rather low on RAM, let's give it a minute")
            await ns.sleep(1000)
        } else if (server.hackDifficulty > server.minDifficulty) {
            let weakenCallsRequired = Math.ceil((server.hackDifficulty - server.minDifficulty) / 0.05)
            let maxCalls = Math.floor(availableLocalRam / weakenRamCost)

            ns.tprint("weakenCallsRequired: " + weakenCallsRequired)
            ns.tprint("maxCalls: " + maxCalls)

            if (weakenCallsRequired >= maxCalls) {
                ns.tprint("Need more [weaken] calls than can fit in memory, let's go ham.")
                await ns.run("weaken.js", maxCalls, target);
                await ns.sleep(weakenTime)
            } else {
                ns.tprint("All [weaken] calls fit in RAM, let's also grow some.")
                await ns.run("weaken.js", weakenCallsRequired, target);
                let growThreadCount = calculateGrowThreadCount(availableLocalRam, weakenRamCost, weakenCallsRequired, growRamCost)
                ns.tprint("growThreadCount: " + growThreadCount)

                await ns.run("grow.js", growThreadCount, target);
                await ns.sleep(weakenTime)
            }
        } else if (server.moneyAvailable < server.moneyMax) {
            let growthAmount = server.moneyMax / server.moneyAvailable
            ns.tprint("Money available: " + server.moneyAvailable + " max: " + server.moneyMax + " factor: " + growthAmount)

            let maxCalls = Math.floor(availableLocalRam / growRamCost)

            // When available cash is 0, growthAmount is Infinite so growthAnalyze won't work
            let growthCallsRequired = maxCalls
            if(server.moneyAvailable != 0) {
                growthCallsRequired = Math.ceil(ns.growthAnalyze(target, growthAmount, localhost.cpuCores))
            }
            ns.tprint("growth calls required: " + growthCallsRequired)


            if (growthCallsRequired >= maxCalls) {
                ns.tprint("More than max calls required, let's send it for maxCalls " + maxCalls)
                await ns.run("grow.js", maxCalls, target)
            } else {
                let securityIncrease = ns.growthAnalyzeSecurity(growthCallsRequired)
                let weakenThreadCount = maxCalls - growthCallsRequired
                ns.tprint("This grow will increase security by " + securityIncrease);
                ns.tprint("Will also weaken with remaining threads: " + weakenThreadCount)
                await ns.run("grow.js", growthCallsRequired, target);
                await ns.run("weaken.js", weakenThreadCount, target);
                await ns.sleep(weakenTime)
            }
        }
    }


    let server = ns.getServer(target)
    ns.tprint("Server maximised!")
    ns.tprint("server.moneyAvailable: " + server.moneyAvailable)
    ns.tprint("server.moneyMax: " + server.moneyMax)
    ns.tprint("server.hackDifficulty: " + server.hackDifficulty)
    ns.tprint("server.minDifficulty: " + server.minDifficulty)
}