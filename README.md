# bitburner_scipts

My [BitBurner](https://danielyxie.github.io/bitburner/) scripts. This is a loose collection of scripts I use in the game. There's no guarantee they're any good, but I was starting to feel bad these weren't in source control!

## Todo:

- [ ] Make bootstrap record the current time when it starts
- [ ] Set purchasing targets for various managers based on time, and in text files on HOME
- [ ] Make a tool manager that buys a TOR router and purchases the appropriate bits from the black market when there's room in the budget
- [ ] Create a list of targets using scan-analyze
- [ ] Modify the hack script to take a target from a file
- [ ] Make a hack orchestrator / manager that picks a target and distributes it to relevant nodes

## Useful snippets

Pending organising these scripts into their own actual 'library' like structures, here's some useful snippets:

```javascript
function logHash(hash) {
    let details = ""
    for (var key in hash) {
        ns.tprint("[" + key + "]: " + hash[key])
    }

    return details.join("\n")
}
```
