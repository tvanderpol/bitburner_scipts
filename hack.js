/** @param {NS} ns **/
export async function main(ns) {
    let target;
    if (ns.args.length == 0) {
        ns.tprint("Please supply a target as the first argument")
        ns.exit()
    } else {
        target = ns.args[0]
    }

    let response = await ns.hack(target);
    ns.tprint("hack complete on " + target + ": " + response)
}