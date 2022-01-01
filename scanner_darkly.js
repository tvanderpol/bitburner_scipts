/** @param {NS} ns **/

let serverList = new Map()

function serverEntryFor(hostname, parent, explored = false) {
  if (serverList.has(hostname)) {
    return serverList.get(hostname)
  } else {
    serverList.set(hostname, {hostname: hostname, parent: parent, explored: explored})
    return serverList.get(hostname)
  }
}

function breach(ns, hostname) {
  if (ns.fileExists("BruteSSH.exe", "home")) {
    ns.brutessh(hostname);
  }

  if (ns.fileExists("FTPCrack.exe", "home")) {
    ns.ftpcrack(hostname);
  }

  if (ns.fileExists("FTPCrack.exe", "home")) {
    ns.ftpcrack(hostname);
  }

  if (ns.fileExists("HTTPWorm.exe", "home")) {
    ns.httpworm(hostname);
  }

  if (ns.fileExists("relaySMTP.exe", "home")) {
    ns.relaysmtp(hostname);
  }

  if (ns.fileExists("SQLInject.exe", "home")) {
    ns.sqlinject(hostname);
  }

  let serverDetails = ns.getServer(hostname)

  if(serverDetails.openPortCount >= serverDetails.numOpenPortsRequired) {
    ns.print("Rooting " + hostname)
    ns.nuke(hostname);
  } else {
    ns.print(hostname + " is too tough for right now.")
  }
}

function renderPath(node) {
  let parentage = [node.parent, node]
  let parent = node.parent
  while(parent != null) {
    parentage.unshift(parent.parent)
    parent = parent.parent
  }

  let nodeHierarchy = parentage
    .filter(p => p != null)
    .map(p => p["hostname"])

  let readablePath = "/" + nodeHierarchy.join("/")
  let connectablePath = "connect " + nodeHierarchy.slice(1, nodeHierarchy.length).join("; connect ") + ";"
  return `
    Path: ${readablePath}
    EZ-cnx: 
      ${connectablePath}
  `
}

function searchForHost(hostname) {
  if(serverList.has(hostname)) {
    return renderPath(serverList.get(hostname))
  } else {
    return "No host named '" + hostname + "' found on network."
  }
}

function mapServers(ns) {
  let queue = []
  let root = serverEntryFor("home", null)
  queue.push(root)
  while(queue.length > 0) {
    let target = queue.pop()
    if(!target["explored"]) {
      let children = ns.scan(target["hostname"])
      if(children.length === 0) {
        return renderPath(target, searchTerm)
      } else {
        children.forEach(c => queue.push(serverEntryFor(c, target)))
      }
      target["explored"] = true
    }
  }
}

function allServers() {
  let hostnames = []
  serverList.forEach((_, hostname) => hostnames.push(hostname))
  return hostnames
}

function renderServer(s) {
  return `=== ${s.hostname} ===
  hacking req: ${s.requiredHackingSkill}
  maxMoney: ${s.moneyMax}
  rewardRatio: ${s.moneyMax / s.minDifficulty}
  growth: ${s.serverGrowth}`
}

function serverAttractivenessScore(s) {
  let rewardRatio = s.moneyMax / s.minDifficulty
  
  return rewardRatio
}

export function currentTargetList(ns) {
  return allServers()
    .map(s => ns.getServer(s))
    .filter(s => s.requiredHackingSkill <= ns.getHackingLevel())
    .filter(s => s.hasAdminRights )
    .sort((a, b) => serverAttractivenessScore(b) - serverAttractivenessScore(a))
    .slice(0, 3)
}

export function currentComputeTargets(ns) {
  return allServers()
    .map(s => ns.getServer(s))
    .filter(s => s.requiredHackingSkill <= ns.getHackingLevel())
    .filter(s => s.hasAdminRights )
    .filter(s => s.maxRam > 0)
    .map(s => { return s.hostname })
}

export async function main(ns) {
  ns.toast("SCNNR: Engaged", "info")
  mapServers(ns)

  let command;
  let value;
  if(ns.args.length > 0) {
    command = ns.args[0]
    value = ns.args[1]
  }

  if(command === "find") {
     ns.tprint(searchForHost(value))
  } else if(command === "root") {
    allServers().forEach(host => breach(ns, host))
    ns.tprint("Rooted what I could!")
  } else if(command === "listAll") {
    ns.tprint("All servers I found: " + allServers().join(", "))
  } else if(command === "targets") {
    ns.tprint("Targets found:\n\n" + currentTargetList(ns).map(s => { return renderServer(s) }).join("\n"))
  } else if(command === "compute") {
    ns.tprint("Targets found:\n\n" + currentComputeTargets(ns).join(", "))
  }
}