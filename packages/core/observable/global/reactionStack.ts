/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { globalTaskEmitter } from ".";

class ReactionStack {
  private reactionStack: Function[] = [];

  regist(operation: any) {
    let reaction = this.getCurrentReaction();

    if (reaction) {
      globalTaskEmitter.registReaction(reaction, operation);
    }
  }

  autoRun(reaction: any, fn: any) {
    const { reactionStack } = this;
    if (reactionStack.indexOf(reaction) === -1) {
      try {
        reactionStack.push(reaction);
        return fn();
      } finally {
        reactionStack.pop();
      }
    }
  }

  getCurrentReaction() {
    const { reactionStack } = this;
    const reaction = reactionStack[reactionStack.length - 1];

    return reaction;
  }
}

export const globalReactionStack = new ReactionStack();
