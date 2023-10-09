import { globalTaskEmitter } from ".";

class ReactionStack {
  private reactionStack: Function[] = [];

  regist(operation) {
    let reaction = this.getCurrentReaction();

    if (reaction) {
      globalTaskEmitter.registReaction(reaction, operation);
    }
  }

  autoRun(reaction, fn) {
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
