/** @param {NS} ns **/
export default class {
    constructor(ns) {
        this.ns = ns
        this.tools = ["AutoLink.exe", "BruteSSH.exe", "DeepscanV1.exe", "DeepscanV2.exe", "Formulas.exe", "FTPCrack.exe", "HTTPWorm.exe", "relaySMTP.exe", "ServerProfiler.exe", "SQLInject.exe"]
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