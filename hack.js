/** @param {NS} ns **/
export async function main(ns) {
    let target;
    let desiredSleep = 0
    if (ns.args.length < 1) {
        ns.tprint("Please supply a target as the first argument")
        ns.exit()
    } else {
        target = ns.args[0]
        if(ns.args.length == 2) {
            desiredSleep = ns.args[1]
        }
    }

    await ns.sleep(desiredSleep)
    let response = await ns.hack(target);
    ns.print("hack complete on " + target + ": " + response)
}