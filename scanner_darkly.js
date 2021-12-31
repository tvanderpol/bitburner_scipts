/** @param {NS} ns **/

let globalServerList = new Map()

class Server {
  constructor(ns, value) {
    this.ns = ns
    this.value = value;
    this.descendents = [];
    this.parent = [];
    this.root = false;
    this.processed = false
  }

  get hostname() {
    return this.value["hostname"]
  }

  get requiredHackingSkill() {
    return this.value["requiredHackingSkill"]
  }

  get moneyMax() {
    return this.value["moneyMax"]
  }

  get minDifficulty() {
    return this.value["minDifficulty"]
  }

  get rewardRatio() {
    return this.moneyMax / this.minDifficulty
  }

  get connectedServers() {
    return this.descendents
  }

  set connectedServers(list) {
    if (Array.isArray(list)) {
      this.descendents = list
    } else {
      this.ns.fprint("Trying to add NotAnArray to descendents for " + this.hostname + " (running on " + this.ns.getServer().hostname + ")")
    }
  }

  updateDetails() {
    this.value.details = this.ns.getServer(this.hostname)
  }

  breach() {
    if (this.ns.fileExists("BruteSSH.exe", "home")) {
      this.ns.brutessh(this.hostname);
    }

    if (this.ns.fileExists("FTPCrack.exe", "home")) {
      this.ns.ftpcrack(this.hostname);
    }

    if (this.ns.fileExists("FTPCrack.exe", "home")) {
      this.ns.ftpcrack(this.hostname);
    }

    if (this.ns.fileExists("HTTPWorm.exe", "home")) {
      this.ns.httpworm(this.hostname);
    }

    if (this.ns.fileExists("relaySMTP.exe", "home")) {
      this.ns.relaysmtp(this.hostname);
    }

    if (this.ns.fileExists("SQLInject.exe", "home")) {
      this.ns.sqlinject(this.hostname);
    }

    this.ns.print("About to nuke " + this.hostname)
    this.ns.nuke(this.hostname);
  }
}

function serverEntryFor(ns, hostname) {
  if (globalServerList.has(hostname)) {
    return globalServerList.get(hostname)
  } else {
    globalServerList.set(hostname, new Server(ns, ns.getServer(hostname)))
    return globalServerList.get(hostname)
  }
}

function alreadySeen(hostname) {
  return globalServerList.has(hostname)
}

function connectedServersFor(ns, server) {
  if (!(server instanceof Server)) {
    ns.tprint("server: " + server + " isn't a Server object")
    return
  }
  return ns.scan(server.hostname)
    .map(name => { return { hostname: name, details: ns.getServer(name) } })
    .filter(info => { return !info.details.purchasedByPlayer })
    .filter(info => { return !alreadySeen(info["hostname"]) })
    .map(info => { return serverEntryFor(ns, info["hostname"]) })
    .map(newServer => { newServer.parent = server; return newServer })
    // .filter(newServer => { return newServer.parent == newServer })
    // .map(server => { if(alreadySeen(server.hostname)) {server.processed = true}; return server })
}

function detectCyclicalRelationships(ns, node) {
  let parentage = [node, node.parent]
  let parentToCheck = node.parent;
  while(!parentToCheck.root) {
    parentage.push(parentToCheck.parent)
    parentToCheck = parentToCheck.parent
    ns.tprint("Parentage so far: " + parentage.map(p => p.hostname).join(", "))
  }

  ns.tprint(node.hostname + " has cyclical parentage(" + parentage.map(p => p.hostname) + "): " + (new Set(parentage).size != parentage.length))

  return (new Set(parentage).length != parentage.length)
}

function processConnectedServers(ns, parentNode) {
  ns.tprint("processing children of " + parentNode.hostname)
  parentNode.descendents.forEach(node => { ns.tprint("gonna check " + node.hostname + " is processed: " + node.processed) })
  let nodesToProcess = parentNode.descendents.filter(node => { return !node.processed })
    // .filter(node => detectCyclicalRelationships(ns, node))
  ns.tprint("nodesToProcess.length: " + nodesToProcess.length);
  nodesToProcess.forEach(node => { ns.tprint("processing " + node.hostname) })
  nodesToProcess.forEach(node => { node.breach() })
  nodesToProcess.forEach(node => { node.updateDetails() })
  nodesToProcess.forEach(node => { node.connectedServers = connectedServersFor(ns, node) })
  nodesToProcess.forEach(node => { ns.tprint("found " + node.descendents.length + " connected servers") })
  nodesToProcess.forEach(node => { node.processed = true })
  nodesToProcess.forEach(node => { processConnectedServers(ns, node) })
}

function topThreeServers(ns, serverList) {
  let formattedList = []
  for (const entry of serverList) {
    let hostname = entry[0]
    let details = entry[1]
    formattedList.push({
      hostname: hostname,
      requiredHackingSkill: details.requiredHackingSkill,
      moneyMax: details.moneyMax,
      minDifficulty: details.minDifficulty,
      rewardRatio: details.rewardRatio,
    })
  }

  return formattedList
    .filter(entry => entry["requiredHackingSkill"] <= ns.getHackingLevel())
    .sort((a, b) => b["rewardRatio"] - a["rewardRatio"])
    .map(server => { return server['hostname'] + "[" + server['requiredHackingSkill'] + "]" })
    .slice(0, 3)
    .join(", ")
}

function findServerPath(ns, searchNode, searchName, acc = []) {
  acc.push(searchNode.hostname)

  let path = []

  searchNode.connectedServers.forEach(node => {
    let hostname = node.hostname
    acc.push(hostname)
    ns.tprint("Checking if search '" + searchName + "' matches " + acc.join(" > ") + " > [" + hostname + "]")
    if (hostname == searchName) {
      path.push(acc.join(" > "))
      // return 
    } else {
      if (node.connectedServers.length > 0) {
        // ns.tprint("This one ain't it but it's got kids: " + node)
        findServerPath(ns, node, searchName, acc)
      } else {
        return
      }
    }
  })

  return path
}

export async function main(ns) {
  ns.toast("SCNNR: Engaged", "info")
  let home = serverEntryFor(ns, "home")
  home.processed = true
  home.root = true

  home.connectedServers = connectedServersFor(ns, home)
  processConnectedServers(ns, home)

  ns.tprint("Here's the juiciest targets so far:\n" + topThreeServers(ns, globalServerList))
  ns.tprint("Server path for mystery '.': " + findServerPath(ns, home, "I.I.I.I"))
}