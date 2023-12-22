declare module '*.lazy.less' {
  const locals: {[key: string]: string};
  const unuse: () => void;
  const use: ({target}: {target: Node}) => void 
}
