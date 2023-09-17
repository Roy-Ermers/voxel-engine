export type FunctionExtractor<t> = {
  [k in keyof t]: t[k] extends (...args: infer p) => infer r
    ? (...args: p) => r
    : never;
};
