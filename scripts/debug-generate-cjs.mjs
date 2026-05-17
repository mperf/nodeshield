import { create as createNames, generators } from '../src/box/names.js';
import { generateBoxCjs } from '../src/box/cjs/index.js';
import { STRATEGIES } from '../src/policy.js';

const nameGen = createNames(generators.random);
const src = `console.log('hello');`;
const permissions = {
  code: true,
  network: false,
  crypto: false,
  process: false,
  import: { packages: [], files: [] },
};
const paths = {
  inRoot: process.cwd(),
  outRoot: process.cwd(),
  ogDirAbs: process.cwd(),
  ogFileAbs: process.cwd() + '/program.cjs',
  ogFile: 'program.cjs',
  outDirAbs: process.cwd(),
  hiddenRel: '.',
};

const code = generateBoxCjs({ names: nameGen, src, permissions, paths, strategy: STRATEGIES.throw, file: 'program.cjs' });
console.log(code);
