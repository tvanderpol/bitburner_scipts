/** @param {NS} ns **/

import Don from 'gang/don.js'
import Messenger from 'global_messenger'

export async function main(ns) {
  ns.disableLog("ALL")
  let messenger = new Messenger(ns, 'GANG')
  messenger.queue("The Don is here", 'success')
  let don = new Don(ns, messenger)

  while (true) {
    don.manage()
    messenger.emit()
    await ns.sleep(10000)
  }
}