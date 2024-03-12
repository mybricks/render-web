import * as R from "ramda";

export function asyncPipe(...funcs: any) {
  return R.pipe(
    // @ts-ignore
    ...funcs.map((func: any, index: number) => {
      if (typeof func === "function") {
        return !index ? func : R.andThen(func);
      }

      return !index ? () => func : R.andThen(() => func);
    }),
  );
}

export function createPromise() {
  let resolveFn = () => {};

  const promise = new Promise((resolve: (value?: unknown) => void) => {
    resolveFn = resolve;
  }) as Promise<unknown> & { resolve: (value?: unknown) => void };

  promise.resolve = resolveFn;

  return promise;
}
