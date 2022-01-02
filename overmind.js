/** @param {NS} ns **/

// import * as util from "utils.js"
import ServerFleetManager from "server_fleet_manager.js"
import WorkloadManager from "workload_manager.js"
import ToolsManager from "tools_manager.js"
import NetworkScanner from "network_scanner.js"
import GlobalMessenger from "global_messenger.js"
import NF from "util_number_formatter.js"


export async function main(ns) {
    ns.disableLog("ALL")
    let messenger = new GlobalMessenger(ns, "OVERMIND")
    let serverFleetManager = new ServerFleetManager(ns, messenger)
    let workloadManager = new WorkloadManager(ns, messenger)
    let toolsManager = new ToolsManager(ns)
    let networkScanner = new NetworkScanner(ns, messenger)
    let nf = new NF(ns)
    let lastMessaged = 0

    while (true) {
        // TODO: manage hacknet buying

        let missingTools = toolsManager.checkForMissingTools()
        if (missingTools.size != 0) {
            for (let tool of missingTools) {
                messenger.queue("Missing tool: " + tool, "warning")
            }
        }

        networkScanner.mapServers()
        let inaccessibleHosts = networkScanner.breachAll()
        messenger.queue("Can't root " + inaccessibleHosts + " servers yet", "warning")

        workloadManager.botnet = networkScanner.allRootedServers

        if (serverFleetManager.upgradesRemaining()) {
            let nextFleetUpgradeCost = serverFleetManager.nextUpgradeCost()
            let currentBalance = ns.getServerMoneyAvailable("home");
            let desiredSpend = currentBalance * 0.1
            let maxSpend = currentBalance * 0.12
            if (nextFleetUpgradeCost < desiredSpend) {
                serverFleetManager.buyNextUpgrade(maxSpend)
            } else {
                messenger.queue("Next upgrade costs " + nf.money(nextFleetUpgradeCost) + " - bit out of the budget", "info")
            }
        }

        let hackTargets = networkScanner.currentTargetList()
        workloadManager.targetList = hackTargets

        await workloadManager.plan()

        messenger.emit()

        await ns.sleep(1000)
    }
}