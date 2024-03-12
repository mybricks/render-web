import { isObject } from "../";
import { proxyToRaw, rawToProxy } from ".";

class TaskEmitter {
  private taskMap = new WeakMap();

  private reactionToTaskMap = new WeakMap();

  addTask(obj: any) {
    this.taskMap.set(obj, new Map());
  }

  deleteTask(obj: any) {
    if (!isObject(obj)) {
      return;
    }

    const target = proxyToRaw.get(obj);

    proxyToRaw.delete(obj);
    rawToProxy.delete(target);

    this.taskMap.delete(target);
  }

  deleteReaction(reaction: any) {
    const reactionToTask = this.reactionToTaskMap.get(reaction);

    if (!reactionToTask) {
      return;
    }

    this.reactionToTaskMap.delete(reaction);

    reactionToTask.forEach((task: any) => {
      task.forEach((value: any) => {
        value.delete(reaction);
      });
    });
  }

  registReaction(reaction: any, { target, key }: any) {
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

  getReactions({ target, key }: any) {
    const task = this.taskMap.get(target);

    if (!task) {
      return [];
    }

    const reactions = task.get(key) || [];

    return reactions;
  }

  runTask(operation: any) {
    const reactions = this.getReactions(operation);

    if (reactions.size) {
      reactions.forEach(run);
    }
  }
}

function run(fn: any) {
  fn();
}

export const globalTaskEmitter = new TaskEmitter();
