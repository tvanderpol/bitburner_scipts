/** @param {NS} ns **/

import NetworkScanner from "network_scanner.js"
import GlobalMessenger from "global_messenger.js"

export async function main(ns) {
    let messenger = new GlobalMessenger(ns, "SCNRDRKLY")
    let networkScanner = new NetworkScanner(ns, messenger)

    if (ns.args.length < 2) {
        ns.tprint("Please supply a command and a hostname to act on")
    }
    let command = ns.args[0]
    let targetHostname = ns.args[1]

    if ("search" == command) {
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
        let nodePath = networkScanner.findPath(targetHostname)
        if (typeof (nodePath) === String) {
            ns.tprint(nodePath)
        } else {
            let connectablePath = "connect " + nodePath.slice(1, nodePath.length).join("; connect ") + ";"
            ns.tprint(connectablePath + " backdoor;")
        }
    }
}

export function autocomplete(data, args) {
    return [...data.servers]; // This script autocompletes the list of servers.
}