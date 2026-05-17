import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createFsShimCodeCjs } from '../../src/box/internals/fs.js';

function makeTempDir() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nodeshield-fs-'));
  return base;
}

function writeGlobals(dir) {
  const code = `module.exports = { primordials: { ConsoleLog: (...a)=>console.log(...a), ProcessExit: (c)=>process.exit(c), ReflectApply: Reflect.apply, NewError: (m)=> new Error(m) }, app: globalThis };`;
  fs.writeFileSync(path.join(dir, 'globals.cjs'), code);
}

test('fs shim blocks and allows read/write/meta based on permissions (CJS shim)', async (t) => {
  const dir = makeTempDir();
  writeGlobals(dir);

  // Inject a fake host module
  const fakeHost = `const hostModule = ({ 
    readFile: function(){ return 'READ_OK'; }, 
    writeFile: function(){ return 'WRITE_OK'; }, 
    chmod: function(){ return 'CHMOD_OK'; },
    openSync: function(){ return 'OPEN_OK'; },
    promises: { 
      readFile: async function(){ return 'PROM_READ'; },
      writeFile: async function(){ return 'PROM_WRITE'; }
    } 
  });`;

  const src = createFsShimCodeCjs();
  const patched = src.replace(/const hostModule = require\("node:fs"\);/, fakeHost);

  fs.writeFileSync(path.join(dir, 'fs.cjs'), patched);

  const fsShim = (await import(path.join('file://' + path.join(dir, 'fs.cjs')))).default || require(path.join(dir, 'fs.cjs'));

  // Blocked case - read
  globalThis.__nodeShieldContext = { id: 'f1', strategy: 'throw', permissions: { network: false, fsSubcaps: { read: false, write: false, meta: false } } };

  assert.throws(() => fsShim.readFile('/tmp/test'), /not allowed/);
  await assert.rejects(() => fsShim.promises.readFile('/tmp/test'), /not allowed/);
  
  // Allowed case - read
  globalThis.__nodeShieldContext.permissions.fsSubcaps.read = true;
  const r = fsShim.readFile('/tmp/test');
  assert.equal(r, 'READ_OK');
  const pr = await fsShim.promises.readFile('/tmp/test');
  assert.equal(pr, 'PROM_READ');

  // Blocked case - write
  globalThis.__nodeShieldContext.permissions.fsSubcaps.write = false;
  assert.throws(() => fsShim.writeFile('/tmp/test', 'data'), /not allowed/);
  await assert.rejects(() => fsShim.promises.writeFile('/tmp/test', 'data'), /not allowed/);

  // Allowed case - write
  globalThis.__nodeShieldContext.permissions.fsSubcaps.write = true;
  const w = fsShim.writeFile('/tmp/test', 'data');
  assert.equal(w, 'WRITE_OK');
  const pw = await fsShim.promises.writeFile('/tmp/test', 'data');
  assert.equal(pw, 'PROM_WRITE');

  // Blocked case - meta
  globalThis.__nodeShieldContext.permissions.fsSubcaps.meta = false;
  assert.throws(() => fsShim.chmod('/tmp/test', 0o644), /not allowed/);

  // Allowed case - meta
  globalThis.__nodeShieldContext.permissions.fsSubcaps.meta = true;
  const m = fsShim.chmod('/tmp/test', 0o644);
  assert.equal(m, 'CHMOD_OK');

  // Test open with 'r' flag requires read
  globalThis.__nodeShieldContext.permissions.fsSubcaps.read = false;
  globalThis.__nodeShieldContext.permissions.fsSubcaps.write = false;
  assert.throws(() => fsShim.openSync('/tmp/test', 'r'), /not allowed/);

  // Test open with 'w' flag requires write
  assert.throws(() => fsShim.openSync('/tmp/test', 'w'), /not allowed/);

  // Allow both, open should work
  globalThis.__nodeShieldContext.permissions.fsSubcaps.read = true;
  globalThis.__nodeShieldContext.permissions.fsSubcaps.write = true;
  const o = fsShim.openSync('/tmp/test', 'r');
  assert.equal(o, 'OPEN_OK');
});
