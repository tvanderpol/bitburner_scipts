/** @param {NS} ns **/

// import * as util from "utils.js"
import ServerFleetManager from "server_fleet_manager.js"
import Scheduler from "scheduler/scheduler.js"
import ToolsManager from "tools_manager.js"
// import SingularityToolsManager from "singularity_tools_manager.js"
import NetworkScanner from "network_scanner.js"
import GlobalMessenger from "global_messenger.js"
import NF from "util_number_formatter.js"

export async function main(ns) {
    ns.disableLog("ALL")
    let messenger = new GlobalMessenger(ns, "OVERMIND")
    let serverFleetManager = new ServerFleetManager(ns, messenger)
    let networkScanner = new NetworkScanner(ns, messenger)
    let scheduler = new Scheduler(ns, messenger, networkScanner)
    let toolsManager = new ToolsManager(ns)

    let nf = new NF(ns)

    while (true) {
        // TODO: manage hacknet buying
        let currentBalance = ns.getServerMoneyAvailable("home");

        let missingTools = toolsManager.checkForMissingTools()
        if (missingTools.length > 0 && toolsManager.sufficientCashForNextTool(currentBalance)) {
            messenger.queue(missingTools.length + " missing tools.", "warning")
        }

        networkScanner.mapServers()
        let inaccessibleHosts = networkScanner.breachAll()
        if (inaccessibleHosts > 0) {
            messenger.queue("Can't root " + inaccessibleHosts + " servers yet", "warning")
        }

        // TODO: I still don't understand why newly bought private servers don't show up in this
        // For now I'm tired so brute forcing it.
        let allRootedServers = networkScanner.allRootedServers.map(s => s.hostname)
        let purchasedServers = ns.getPurchasedServers()
        let allServers = new Set(allRootedServers.concat(purchasedServers))
        scheduler.workpoolServers = [...allServers].map(s => ns.getServer(s))

        if (serverFleetManager.upgradesRemaining()) {
            let nextFleetUpgradeCost = serverFleetManager.nextUpgradeCost()
            let desiredSpend = currentBalance * 0.5
            let maxSpend = currentBalance * 0.6
            if (nextFleetUpgradeCost < desiredSpend) {
                serverFleetManager.buyNextUpgrade(maxSpend)
            } else {
                messenger.queue("Next upgrade costs " + nf.money(nextFleetUpgradeCost) + " - bit out of the budget", "info")
            }
        }

        messenger.emit()

        await scheduler.run()

        let currentTime = ns.getTimeSinceLastAug()

        // Run scheduler in the latter half of the second, first 500ms is for running tasks
        let nextFullSecond = (Math.ceil(currentTime / 1000) * 1000) + 500
        await ns.sleep(nextFullSecond - currentTime)
    }
}