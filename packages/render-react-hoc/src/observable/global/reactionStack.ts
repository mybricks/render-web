import { globalTaskEmitter } from ".";

class ReactionStack {
  private reactionStack: any[] = [];

  regist(operation: any) {
    const reaction = this.getCurrentReaction();

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
