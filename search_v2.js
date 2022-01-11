/** @param {NS} ns **/

import NetworkScanner from "network_scanner.js"
import NF from 'util_number_formatter.js'
import GlobalMessenger from "global_messenger.js"

function prettyPrint(networkScanner, ns, nf, target) {
    return `
    ================================
    = hostname:    ${target.hostname}
    ================================
    =
    = path:          /${networkScanner.findPath(target.hostname).join("/")}
    = cash:          ${nf.money(target.moneyAvailable)} / ${nf.money(target.moneyMax)} (${(target.moneyAvailable / target.moneyMax * 100).toFixed(2)}%)
    = score:         ${target.score}
    = hacking req:   ${target.requiredHackingSkill}
    = diff:          ${target.hackDifficulty.toFixed(2)} / ${target.minDifficulty}
    = growth:        ${ns.getServerGrowth(target.hostname)}
    = hack time:     ${ns.tFormat(ns.getHackTime(target.hostname))}
    = grow time:     ${ns.tFormat(ns.getGrowTime(target.hostname))}
    = weaken time:   ${ns.tFormat(ns.getWeakenTime(target.hostname))}

`
}

export async function main(ns) {
    let messenger = new GlobalMessenger(ns, "SCNRDRKLY")
    let nf = new NF(ns)
    let networkScanner = new NetworkScanner(ns, messenger)
    networkScanner.mapServers()

    let command = ns.args[0]

    if ("search" == command) {
        if (ns.args.length < 2) {
            ns.tprint("Please supply a command and a hostname to act on")
        }
        let targetHostname = ns.args[1]
        let nodePath = networkScanner.findPath(targetHostname)
        let readablePath = "/" + nodePath.join("/")
        let connectablePath = "connect " + nodePath.slice(1, nodePath.length).join("; connect ") + ";"
        if (typeof (nodePath) === String) {
            ns.tprint(nodePath)
        } else {
            ns.tprint(`
            Path: ${readablePath}
            EZ-cnx: 
            ${connectablePath}
        `)
        }
    } else if ("backdoor" == command) {
        if (ns.args.length < 2) {
            ns.tprint("Please supply a command and a hostname to act on")
        }
        let targetHostname = ns.args[1]
        let nodePath = networkScanner.findPath(targetHostname)
        if (typeof (nodePath) === String) {
            ns.tprint(nodePath)
        } else {
            let connectablePath = "connect " + nodePath.slice(1, nodePath.length).join("; connect ") + ";"
            ns.tprint(connectablePath + " backdoor;")
        }
    } else if ("targets" == command) {
        let targets = networkScanner.currentTargetList(5)
        let msg = "Current list of targets in priority order:\n"
        for (const target of targets) {
            msg += prettyPrint(networkScanner, ns, nf, target)
        }
        ns.tprint(msg.split("\n").map(l => l.trim()).join("\n"))
    } else if ("juicy_targets" == command) {
        let targets = networkScanner.minSecurityTargetList(5)
        let msg = "Current list of min security targets in priority order:\n"
        for (const target of targets) {
            msg += prettyPrint(networkScanner, ns, nf, target)
        }
        ns.tprint(msg.split("\n").map(l => l.trim()).join("\n"))
    }
}

export function autocomplete(data, args) {
    return [...data.servers]; // This script autocompletes the list of servers.
}