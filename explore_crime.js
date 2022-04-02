/** @param {NS} ns **/

export async function main(ns) {
  const crime = 'shoplift'

  let doingCrime = true
  let timeBetweenCrime = 0

  while (doingCrime) {
    if (!ns.isBusy()) {
      if (timeBetweenCrime = 0)
        ns.tprint(`Gonna commit a cheeky ${crime}`)
      ns.commitCrime(crime)
    }
    await ns.sleep(2000)
  }
  // let details = ns.getCrimeStats('larceny')
  // for (const key of Object.keys(details)) {
  //   ns.tprint(`larceny: ${key}: ${details[key]}`)
  // }
}