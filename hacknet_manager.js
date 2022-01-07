/** @param {NS} ns **/

const MIN_SLEEP = 50;
const FULL_SLEEP = 30_000;
const MIN_MONEY = 0;
const DESIRED_NODE_COUNT = 8;
const DESIRED_NODE_LEVEL = 100;
const DESIRED_NODE_RAM = 32;
const DESIRED_NODE_CORES = 8;

function getNodeListFor(numNodes) {
    var nodes = [];
    for (var i = 0; i < numNodes; i++) {
        nodes.push(i)
    }

    return nodes;
}

function currentAvailableMoney(ns) {
    return ns.getServerMoneyAvailable("home") - MIN_MONEY;
}

function reachedDesiredHacknet(ns, nodeList) {
    let nodesUpgraded = nodeList.map(node => {
        const stats = ns.hacknet.getNodeStats(node)
        return stats["level"] >= DESIRED_NODE_LEVEL &&
            stats["ram"] >= DESIRED_NODE_RAM &&
            stats["cores"] >= DESIRED_NODE_CORES
    })

    return !nodesUpgraded.includes(false)
}

function findCheapestUpgrade(ns, nodeList) {
    let currentCheapest = { price: currentAvailableMoney(ns) * 10 }
    nodeList.forEach((nodeIdx) => {
        let nodeStats = ns.hacknet.getNodeStats(nodeIdx);
        let levelCost = ns.hacknet.getLevelUpgradeCost(nodeIdx, 1)
        let ramCost = ns.hacknet.getRamUpgradeCost(nodeIdx, 1)
        let coreCost = ns.hacknet.getCoreUpgradeCost(nodeIdx, 1)

        if (levelCost < currentCheapest["price"] && nodeStats["level"] < DESIRED_NODE_LEVEL) {
            currentCheapest = { nodeIdx: nodeIdx, type: "level", price: levelCost }
        }

        if (ramCost < currentCheapest["price"] && nodeStats["ram"] < DESIRED_NODE_RAM) {
            currentCheapest = { nodeIdx: nodeIdx, type: "ram", price: ramCost }
        }

        if (coreCost < currentCheapest["price"] && nodeStats["cores"] < DESIRED_NODE_CORES) {
            currentCheapest = { nodeIdx: nodeIdx, type: "core", price: coreCost }
        }
    })

    return currentCheapest
}

export async function main(ns) {
    ns.toast("HCKNTMGR: Engaged", "info")

    ns.disableLog("getServerMoneyAvailable")
    ns.disableLog("sleep")

    while (ns.hacknet.numNodes() < DESIRED_NODE_COUNT) {
        if (currentAvailableMoney(ns) >= ns.hacknet.getPurchaseNodeCost()) {
            var nodeIdx = ns.hacknet.purchaseNode();
            if (-1 != nodeIdx) {
                ns.toast("Bought additional Hacknet node");
            }
        }

        if (currentAvailableMoney(ns) < ns.hacknet.getPurchaseNodeCost()) {
            ns.print("Can't afford to buy all nodes. Gonna sleep for a while");
            await ns.sleep(FULL_SLEEP);
        }
    }

    const nodeList = getNodeListFor(DESIRED_NODE_COUNT)
    ns.print("Reached desired hacknet: " + reachedDesiredHacknet(ns, nodeList));
    while (!reachedDesiredHacknet(ns, nodeList)) {
        let upgrade = findCheapestUpgrade(ns, nodeList);

        if (currentAvailableMoney(ns) > upgrade["price"]) {
            switch (upgrade["type"]) {
                case "level": {
                    ns.hacknet.upgradeLevel(upgrade["nodeIdx"], 1);
                }
                case "ram": {
                    ns.hacknet.upgradeRam(upgrade["nodeIdx"], 1);
                }
                case "core": {
                    ns.hacknet.upgradeCore(upgrade["nodeIdx"], 1);
                }
            }

            ns.print("Bought " + upgrade["type"] + " on node " + upgrade["nodeIdx"] + " for $" + upgrade["price"].toFixed(0))
        }

        // If we're getting low on cash, let's give ourselves some time before trying again:
        if (currentAvailableMoney(ns) < (upgrade["price"] * 2)) {
            ns.toast("HCKNTMGR: Running a bit low on cash there, easing on upgrades", "warning")
            ns.print("Can't afford next upgrade: " + upgrade["type"] + " on node " + upgrade["nodeIdx"] + " for $" + upgrade["price"].toFixed(0))
            ns.print("Sleeping for a while to recoup some cash")
            await ns.sleep(FULL_SLEEP);
        } else {
            await ns.sleep(MIN_SLEEP);
        }
    }

    ns.toast("HCKNTMGR: Finished upgrading!", "success")
}