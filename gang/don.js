/** @param {NS} ns **/

import Member from "gang/member"
import Util from 'util/basic_stuff'
import NameDictionary from "gang/name_dictionary"

export default class {
  constructor(ns, messenger) {
    this.ns = ns
    this.messenger = messenger
    this.util = new Util(ns)
    this.ascenscionTreshold = 1.5
    this.maxMembersTraining = 2
    this.maxMemberCount = 12
    this.maxWantedPercent = 0.01
    this.members = ns.gang.getMemberNames().map(name => new Member(ns, messenger, name))
    this.goals = []
    this.considerStrategy()
  }

  considerStrategy() {
    let gangInfo = this.ns.gang.getGangInformation()
    let faction = gangInfo['faction']
    let wantedPenalty = 1 - gangInfo['wantedPenalty']
    let wantedLevel = gangInfo['wantedLevel']
    let currentFactionRep = this.ns.getFactionRep(faction)
    let factionAugs = this.ns.getAugmentationsFromFaction(faction)
    let maxRepReq = this.findHighestRepReqForAugs(factionAugs)
    let gangTerritory = gangInfo['territory']

    if (this.goals.includes('REDUCE_WANTED') && wantedLevel > 1) {
      // If we're already doing it, just push it down to 1 please
      this.goals = ['REDUCE_WANTED']
      return
    }

    // A sensible default
    this.goals = ["MONEY"]

    if (currentFactionRep < maxRepReq) {
      this.goals.push("REP")
    }

    if (gangTerritory < 100) {
      this.goals.push("TERRITORY")
    }

    // Overwrite our multi - priority list
    if (this.ns.gang.getMemberNames().length < this.maxMemberCount) {
      this.goals = ['EXPAND']
    }

    // Let's not lose more than 5% of progress to wanted level
    // 
    // There's a weird bug where wanted level penalty becomes 50% sometimes so let's also check
    // we aren't already at min wanted level.
    if (wantedPenalty > this.maxWantedPercent && wantedLevel > 1) {
      this.goals = ['REDUCE_WANTED']
    }

    this.messenger.queue(`We have our goals: ${this.goals}`, 'info')
    return this.goals
  }

  findHighestRepReqForAugs(augs) {
    let repReq = []

    for (const aug of augs) {
      repReq.push(this.ns.getAugmentationRepReq(aug))
    }

    return Math.max(...repReq)
  }

  updateMemberDetails() {
    let currentNames = this.ns.gang.getMemberNames()
    // Let's see if anyone died
    this.members = this.members.filter(m => {
      const inCurrentNameList = currentNames.includes(m.name)
      if (!inCurrentNameList) {
        this.messenger.queue(`RIP ${m.name}`, 'error')
      }
      return inCurrentNameList
    })
    // Let's see anyone got recruited
    let currentMemberNames = this.members.map(m => m.name)
    for (const name of currentNames) {
      if (!currentMemberNames.includes(name)) {
        this.messenger.queue(`Welcome to the family, ${name}`, 'success')
        this.members.push(new Member(this.ns, this.messenger, name))
      }
    }
  }

  manage() {
    if (this.ns.gang.canRecruitMember()) {
      let name = new NameDictionary(this.ns, this.members).availableName
      this.ns.gang.recruitMember(name)
      this.updateMemberDetails()
    }

    let avgHighestStat = this.util.average(this.members.map(m => m.highestStat))
    let numberofMembersTraining = this.members.filter(m => m.task === 'Train Combat').length
    let trainingSlotAvailable = (numberofMembersTraining < this.maxMembersTraining)

    this.considerStrategy()

    for (let member of this.members) {
      member.updateDetails()
      member.buyUpgrades()

      if (this.goals.includes('REDUCE_WANTED')) {
        member.setTask('Ethical Hacking')
      } else if (this.goals.includes('EXPAND')) {
        if (member.highestStat < avgHighestStat * 0.8) {
          if (member.task !== 'Train Hacking' && trainingSlotAvailable) {
            this.messenger.queue(`${member.name} is going to train hacking for a while...`, 'info')
            member.setTask('Train Hacking')
            // if there's still room we can decide that next time we run this, only 1 trainee at a time
            trainingSlotAvailable = false
          }
        } else {
          member.startMaxInfluenceTask()
        }
      } else {
        if (member.highestStat < avgHighestStat * 0.8) {
          if (member.task !== 'Train Combat' && trainingSlotAvailable) {
            this.messenger.queue(`${member.name} is going to train for a while...`, 'info')
            member.setTask('Train Combat')
            // if there's still room we can decide that next time we run this, only 1 trainee at a time
            trainingSlotAvailable = false
          }
        } else {
          if (member.task !== 'Territory Warfare') {
            this.messenger.queue(`${member.name} is not warring but is plenty yoked, to the battlefield they go!`, 'info')
            member.setTask('Territory Warfare')
          }
        }
      }

      if (member.totalAscenscionBonus > this.ascenscionTreshold) {
        const result = this.ns.gang.ascendMember(member.name)
        if (result !== undefined) {
          this.messenger.queue(`${member.name} has ascended!`, 'success')
        } else {
          this.messenger.queue(`${member.name} tried to ascend but failed :(`, 'error')
        }
      }
    }

    // If we've assigned everyone and no one is training, train the lowest skilled member:
    if (trainingSlotAvailable) {
      let leastSkilledMember = this.members
        .sort((a, b) => a.highestStat - b.highestStat)[0]

      this.messenger.queue(`${leastSkilledMember.name} is lagging in skill, training hacking.`)
      leastSkilledMember.setTask('Train Hacking')
    }
  }
}