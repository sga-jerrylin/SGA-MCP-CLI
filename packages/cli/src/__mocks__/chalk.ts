// Jest mock for chalk (ESM-only in v5, incompatible with Jest CJS environment)
// Returns the input string unchanged — sufficient for all test assertions

type ChalkFn = (str: string) => string;

const identity: ChalkFn = (str) => str;

const chalk = new Proxy(identity, {
  get(_target, prop: string) {
    if (prop === 'default') return chalk;
    // chain calls like chalk.red.bold('text') all return identity
    return new Proxy(identity, {
      get(_t, _p) {
        return identity;
      },
      apply(_t, _thisArg, args: string[]) {
        return args[0] ?? '';
      }
    });
  },
  apply(_target, _thisArg, args: string[]) {
    return args[0] ?? '';
  }
}) as unknown as typeof import('chalk').default;

export default chalk;
