/** @param {NS} ns **/
export async function main(ns) {
  var data = ns.flags([
    ['target', ''],
    ['sleep', 0],
    ['id', ''],
  ])

  let target = data["target"]
  let desiredSleep = data["sleep"]
  let jobId = data["id"]

  await ns.sleep(desiredSleep)
  let response = await ns.hack(target);
  // ns.tprint(`[${jobId}] (slept ${desiredSleep.toFixed(2)}) hack complete on ${target}: ${response}`)
}