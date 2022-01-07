/** @param {NS} ns **/

import Logger from "util/logger.js"

export default class {
  constructor(ns, target) {
    this.ns = ns;
    this.target = target;
    this.id = crypto.randomUUID();
    this.log = new Logger(ns, `Job[${this.id}]`, true)
    this.tasks = new Set();
    this.executeAfter = -1
    this.lastTaskFinished = null
    this.scriptsForTasks = new Map([
      ["weaken", "deploy/weaken.js"],
      ["grow", "deploy/grow.js"],
      ["hack", "deploy/hack.js"],
    ])
  }

  get finishTime() {
    // TODO: This might need to be the end of the timeslot? 
    return this.lastTaskFinished
  }

  addTask(task, runTime, threadCount) {
    this.log.info(`Adding job [task, runTime, threadCount]: ${[task, runTime, threadCount]}`)
    if (threadCount > 0) {
      this.tasks.add(new Map([
        ["task", task],
        ["runTime", runTime],
        ["threadCount", threadCount],
      ]));
    }
  }

  longestRuntime() {
    let runtimes = [...this.tasks].map(t => t.get("runTime"));
    return Math.max(...runtimes);
  }

  async scheduleOn(host) {
    if (this.tasks.size === 0) {
      this.log.dbg(`[${this.id}] No tasks to schedule`);
      return [];
    }
    // needs to calculate the earliest it can finish based on longest task
    let earliestPossibleFinish = this.ns.getTimeSinceLastAug() + this.longestRuntime();
    let desiredTime = Math.max(earliestPossibleFinish, this.executeAfter)
    this.log.dbg(`earliestPossibleFinish: ${earliestPossibleFinish}, this.executeAfter: ${this.executeAfter}, so desiredTime: ${desiredTime}`)
    this.log.dbg(`Job count: ${this.tasks.size} (this.longestRuntime(): ${this.longestRuntime()}) Earliest possible finish: ${earliestPossibleFinish}`);
    // needs to acquire a timeslot from the Target
    let timeSlot = this.target.reserveNextTimeslotAfter(this.id, desiredTime);
    let results = [];
    let additionalDelay = 0
    for (const task of this.tasks) {
      let now = this.ns.getTimeSinceLastAug();
      let earliestFinish = now + task.get("runTime");
      this.log.dbg(`requiredSleep: [timeSlot - earliestFinish + additionalDelay]: ${timeSlot} - ${earliestFinish} + ${additionalDelay}`)
      let requiredSleep = timeSlot - earliestFinish + additionalDelay;
      this.lastTaskFinished = now + requiredSleep + task.get("runTime")
      this.log.dbg(`'${task.get("task")}' would take ${task.get("runTime")} to complete, so adding ${requiredSleep}`);
      this.log.dbg(`Finish would be on ${this.lastTaskFinished}`);
      this.log.dbg("exec(script, host, numThreads, args)")
      let scriptToRun = this.scriptsForTasks.get(task.get("task"))
      let args = [
        "--target", this.target.name,
        "--id", this.id,
        "--sleep", requiredSleep,
      ]

      this.log.dbg(`exec: ${[scriptToRun, host.name, task.get("threadCount"), ...args]}`);
      results.push(await this.ns.exec(scriptToRun, host.name, task.get("threadCount"), ...args));
      additionalDelay += 25
    }

    return results;
    // needs to exec the actual scripts with appropriate sleeps to land inside that timeslot
  }
}
