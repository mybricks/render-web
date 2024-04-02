export function createPromise() {
  let resolveFn = () => {};

  const promise = new Promise((resolve: (value?: unknown) => void) => {
    resolveFn = resolve;
  }) as Promise<unknown> & { resolve: (value?: unknown) => void };

  promise.resolve = resolveFn;

  return promise;
}
