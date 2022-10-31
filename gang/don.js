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
    this.safetyMargin = 4.0
    this.members = ns.gang.getMemberNames().map(name => new Member(ns, messenger, name))
    this.goals = []
    this.considerStrategy()
    this.ourGang = this.ns.gang.getGangInformation()['faction']
    this.otherGangs = [
      "Slum Snakes",
      "Tetrads",
      "The Syndicate",
      "The Dark Army",
      "Speakers for the Dead",
      "NiteSec",
      "The Black Hand"
    ].filter(gangName => gangName != this.ourGang)
    this.initFinished = true
  }

  considerStrategy() {
    // Somehow (async / await?) it's possible this method gets called before init is done.
    if (!this.initFinished) { return }

    let gangInfo = this.ns.gang.getGangInformation()
    let otherGangInfo = this.ns.gang.getOtherGangInformation()
    let ourPower = gangInfo['power']
    let warfareEngaged = gangInfo['territoryWarfareEngaged']
    let wantedPenalty = 1 - gangInfo['wantedPenalty']
    let wantedLevel = gangInfo['wantedLevel']
    let gangTerritory = gangInfo['territory']

    const biggestRival = this.otherGangs.map(gangName => otherGangInfo[gangName])
      .filter(a => a.territory > 0.0)
      .sort((a, b) => b.power - a.power)[0]

    if (!warfareEngaged) {
      if (biggestRival.power * this.safetyMargin < ourPower) {
        this.messenger.queue('We go to WARRRRRRRRR', 'success')
        this.ns.gang.setTerritoryWarfare(true)
      }
    } else if (gangTerritory == 1.0) {
      this.messenger.queue(`And he wept, for there were no streets left to conquer. (disabling warfare)`, 'error')
      this.ns.gang.setTerritoryWarfare(false)
    } else {
      if (biggestRival.power * this.safetyMargin >= ourPower) {
        this.messenger.queue('I dunno what happened but our lead vanished, retreating from war', 'warning')
        this.ns.gang.setTerritoryWarfare(false)
      }
    }

    if (this.goals.includes('REDUCE_WANTED') && wantedLevel > 1) {
      // If we're already doing it, just push it down to 1 please
      this.goals = ['REDUCE_WANTED']
      return
    }

    // if (currentFactionRep < maxRepReq) {
    //   this.goals.push("REP")
    // }

    if (gangTerritory < 1.0) {
      this.goals = ["TERRITORY"]
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

    if (this.goals.length == 0) {
      // A sensible default
      this.goals = ["MONEY"]
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
        member.setTask('Vigilante Justice')
      } else if (this.goals.includes('EXPAND')) {
        if (member.highestStat < avgHighestStat * 0.8) {
          if (member.task !== 'Train Combat' && trainingSlotAvailable) {
            this.messenger.queue(`${member.name} is going to train combat for a while...`, 'info')
            member.setTask('Train Combat')
            // if there's still room we can decide that next time we run this, only 1 trainee at a time
            trainingSlotAvailable = false
          }
        } else {
          member.startEffectiveInfluenceTask()
        }
      } else if (this.goals.includes('MONEY') && this.goals.includes('TERRITORY')) {
        if (Math.random() <= 0.5) {
          member.setTask('Territory Warfare')
        } else {
          member.startMaxMoneyTask();
        }
      } else if (this.goals.includes('MONEY')) {
        member.startMaxMoneyTask();
      } else if (this.goals.includes('TERRITORY')) {
        this.messenger.queue(`${member.name} is not warring but is plenty yoked, to the battlefield they go!`, 'info')
        member.setTask('Territory Warfare')
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

      this.messenger.queue(`${leastSkilledMember.name} is lagging in skill, training combat.`)
      leastSkilledMember.setTask('Train Combat')
    }
  }
}