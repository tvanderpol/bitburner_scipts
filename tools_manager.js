/** @param {NS} ns **/
export default class {
    constructor(ns) {
        this.ns = ns
        this.tools = ["AutoLink.exe", "BruteSSH.exe", "DeepscanV1.exe", "DeepscanV2.exe","FTPCrack.exe", "HTTPWorm.exe", "relaySMTP.exe", "ServerProfiler.exe", "SQLInject.exe"]
    }

    sufficientCashForNextTool(currentBalance) {
        return currentBalance > 250_000_000
    }

    checkForMissingTools() {
        let missingTools = []
        for(let tool of this.tools) {
            if (!this.ns.fileExists(tool, "home")) {
                missingTools.push(tool)
            }            
        }

        return missingTools
    }
}