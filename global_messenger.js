/** @param {NS} ns **/
export default class {
    constructor(ns, prefix = "") {
        this.ns = ns
        this.prefix = prefix
        this.MESSAGE_INTERVAL = 60_000
        this.lastMessaged = 0
        this.messages = new Map()
    }

    queue(msg, requestedLevel = "info") {
        let lvl = this.validLevel(requestedLevel)
        let key = msg+lvl
        this.messages.set(key, [msg, lvl])
    }

    emit() {
        if(this.ns.getTimeSinceLastAug() - this.lastMessaged > this.MESSAGE_INTERVAL) {
            this.sendMessages()
            this.lastMessaged = this.ns.getTimeSinceLastAug()
        }
    }

    sendMessages() {
        for(const [key, message] of this.messages) {
            let msg = message[0]
            let lvl = message[1]
            this.ns.toast(this.prefix + ": " + msg, lvl)
            this.ns.print(lvl.toUpperCase() + ": " + msg)
            this.messages.delete(key)
        }
    }

    validLevel(inputLevel) {
        let validLevels = ["success", "info", "warning", "error"]
        if(validLevels.includes(inputLevel)) {
            return inputLevel
        } else {
            return "error"
        }
    }
}
