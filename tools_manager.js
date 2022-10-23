/** @param {NS} ns **/
export default class {
    constructor(ns, messenger) {
        this.ns = ns;
        this.messenger = messenger;
        this.tools = ns.singularity.getDarkwebPrograms();
        this.haveTor = this.ns.singularity.purchaseTor();
    }

    get canCheckTools() {
        if (!this.haveTor) {
            this.haveTor = this.ns.singularity.purchaseTor();
        }

        return this.haveTor
    }

    get missingTools() {
        let missingTools = []
        if (this.haveTor) {
            for (let tool of this.tools) {
                if (!this.ns.fileExists(tool, "home")) {
                    missingTools.push(tool)
                }
            }
        } else {
            this.haveTor = this.ns.singularity.purchaseTor();
        }

        return missingTools
    }

    get nextMostExpensiveToolCost() {
        return this.missingTools
            .map(tool => this.ns.singularity.getDarkwebProgramCost(tool))
            .sort
            .first
    }

    sufficientCashForNextTool(currentBalance) {
        return currentBalance > nextMostExpensiveToolCost
    }

    buyAllAffordableTools() {
        this.missingTools.map(tool => this.ns.singularity.purchaseProgram(tool))
    }

    buyTool() {
        this.ns.singularity
    }
}