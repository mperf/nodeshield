import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createDgramShimCodeCjs } from '../../src/box/internals/dgram.js';

function makeTempDir() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nodeshield-dgram-'));
  return base;
}

function writeGlobals(dir) {
  const code = `module.exports = { primordials: { ConsoleLog: (...a)=>console.log(...a), ProcessExit: (c)=>process.exit(c), ReflectApply: Reflect.apply, NewError: (m)=> new Error(m) }, app: globalThis };`;
  fs.writeFileSync(path.join(dir, 'globals.cjs'), code);
}

test('dgram shim blocks and allows createSocket based on permissions (CJS shim)', async (t) => {
  const dir = makeTempDir();
  writeGlobals(dir);

  const fakeHost = `const hostModule = ({ createSocket: function(){ return 'SOCKET_OK'; }, send: function(){}, bind: function(){} });`;

  const src = createDgramShimCodeCjs();
  const patched = src.replace(/const hostModule = require\("node:dgram"\);/, fakeHost);

  fs.writeFileSync(path.join(dir, 'dgram.cjs'), patched);

  const dgramShim = (await import(path.join('file://' + path.join(dir, 'dgram.cjs')))).default || require(path.join(dir, 'dgram.cjs'));

  globalThis.__nodeShieldContext = { id: 'u1', strategy: 'throw', permissions: { network: false, networkSubcaps: { udp: false } } };

  assert.throws(() => dgramShim.createSocket(), /not allowed/);

  globalThis.__nodeShieldContext.permissions.networkSubcaps.udp = true;

  const s = dgramShim.createSocket();
  assert.equal(s, 'SOCKET_OK');
});
