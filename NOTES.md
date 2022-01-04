# Notes

*Contains spoilers probably.*

- Buy Sector-12 augs
- Travel to Australia(?) to get Tian Di Hui invite - get their augs to remove passive work penalty
- Connect to `avmnite-02h` and backdoor to grab Nitesec's augs
- Connect to `I.I.I.I` and backdoor to grab The Black Hand's augs
- Connect to `run4theh111z` and backdoor to grab BitRunner's augs

Update the workload planner:

- We need to track changes in flight for weaken and grow per server
- We need to check if a given hack() attempt actually succeeded

* If our current target is not yet maximised:
- Blow it up with weaken and grow calls, weakens first
	-> when scheduling weaken calls check if the amount would 

* If our target is maximised:

- Set a goal as a minimum viable amount of work (say, hack() 1% and grow / weaken to nullify the effect)
- If a given host can theoretically handle that load but doesn't currently have the space, skip it for now
- If a given host can't actually accomodate the workload, set it to work weaken()ing the weakenTarget
	- If the weakenTarget is at minimum security, grow it and weaken to nullify the security impact