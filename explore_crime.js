/** @param {NS} ns **/

export async function main(ns) {
  let crimes = ['assassination', 'bondforgery', 'dealdrugs', 'grandtheftauto', 'heist', 'homicide', 'kidnap', 'larceny', 'mug', 'robstore', 'shoplift', 'traffickarms']

  ns.tail()

  for (const crime of crimes) {
    let details = ns.singularity.getCrimeStats(crime)

    // ns.print(`Details for ${crime}: karma: ${details['karma']}, time: ${details['time']}`)
    ns.print(`Karma loss per second for ${crime}: ${(details['karma'] / details['time']) * 1000}`)
  }
}