/** @param {NS} ns **/

import Logger from "util/logger.js"

export default class {
  constructor(ns, target) {
    this.ns = ns;
    this.target = target;
    this.id = crypto.randomUUID();
    this.log = new Logger(ns, `Job[${this.id}]`, true)
    this.tasks = new Set();
    this.scriptsForTasks = new Map([
      ["weaken", "weaken.js"],
      ["grow", "grow.js"],
      ["hack", "hack.js"],
    ])
    ns.tprint("Job id [" + this.id + "]");
  }

  addTask(task, runTime, threadCount, target) {
    this.tasks.add(new Map([
      ["task", task],
      ["runTime", runTime],
      ["threadCount", threadCount]
    ]));
  }

  longestRuntime() {
    let runtimes = [...this.tasks].map(t => t.get("runTime"));
    return Math.max(...runtimes);
  }

  async scheduleOn(host) {
    if (this.tasks.length === 0) {
      this.log.dbg(`[${this.id}] No tasks to schedule`);
      return;
    }
    // needs to calculate the earliest it can finish based on longest task
    let earliestPossibleFinish = this.ns.getTimeSinceLastAug() + this.longestRuntime();
    this.log.dbg(`Job count: ${this.tasks.length} (this.longestRuntime(): ${this.longestRuntime()}) Earliest possible finish: ${earliestPossibleFinish}`);
    // needs to acquire a timeslot from the Target
    let timeSlot = this.target.reserveNextTimeslotAfter(this.id, earliestPossibleFinish);
    let results = [];
    for (const task of this.tasks) {
      let now = this.ns.getTimeSinceLastAug();
      let earliestFinish = now + task.get("runTime");
      let requiredSleep = timeSlot - earliestFinish;
      this.log.dbg(`task ${task.get("script")} would take ${task.get("runTime")} to complete, so adding ${requiredSleep}`);
      this.log.dbg(`Finish would be on ${now + requiredSleep + task.get("runTime")}`);
      this.log.dbg("exec(script, host, numThreads, args)")
      let scriptToRun = this.scriptsForTasks.get(task.get("task"))
      this.log.dbg(`exec: ${[scriptToRun, host.name, task.get("threadCount"), this.target.name, requiredSleep]}`);
      results.push(await this.ns.exec(scriptToRun, host.name, task.get("threadCount"), this.target.name, requiredSleep));
    }

    return results;
    // needs to exec the actual scripts with appropriate sleeps to land inside that timeslot
  }
}
