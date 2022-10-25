import {isObject} from "../../utils";
import { proxyToRaw, rawToProxy } from ".";

class TaskEmitter {
  private taskMap = new WeakMap();

  private reactionToTaskMap = new WeakMap();

  addTask(obj) {
    this.taskMap.set(obj, new Map());
  }

  deleteTask(obj) {
    if (!isObject(obj)) {
      return;
    }

    const target = proxyToRaw.get(obj);

    proxyToRaw.delete(obj);
    rawToProxy.delete(target);

    const task = this.taskMap.get(target);

    this.taskMap.delete(target);

    for (let key of task.keys()) {
      this.deleteTask(rawToProxy.get(target[key]));

      const reactions = task.get(key);

      reactions?.forEach?.((reaction) => {
        this.deleteReaction(reaction);
      });
    }
  }

  deleteReaction(reaction) {
    let reactionToTask = this.reactionToTaskMap.get(reaction);

    if (!reactionToTask) {
      return;
    }

    this.reactionToTaskMap.delete(reaction);

    reactionToTask.forEach(task => {
      task.forEach((value) => {
        value.delete(reaction);
      });
    });
  }

  registReaction(reaction, { target, key }) {
    const task = this.taskMap.get(target);

    if (task) {
      let reactions = task.get(key);

      if (!reactions) {
        reactions = new Set();
  
        task.set(key, reactions);
      }
  
      if (!reactions.has(reaction)) {
        reactions.add(reaction);
      }
  
      let reactionToTask = this.reactionToTaskMap.get(reaction);
  
      if (!reactionToTask) {
        reactionToTask = new Set();
  
        this.reactionToTaskMap.set(reaction, reactionToTask);
      }
  
      if (!reactionToTask.has(task)) {
        reactionToTask.add(task);
      }
    }
  }

  getReactions({target, key}) {
    const task = this.taskMap.get(target);

    if (!task) {
      return [];
    }

    const reactions = task.get(key) || [];

    return reactions;
  }

  runTask(operation) {
    const reactions = this.getReactions(operation);

    if (reactions.size) {
      reactions.forEach(run);
    }
  }
}

function run(fn) {
  fn();
}

export const globalTaskEmitter = new TaskEmitter();
