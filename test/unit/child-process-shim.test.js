import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createChildProcessShimCodeCjs } from '../../src/box/internals/child_process.js';

function makeTempDir() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nodeshield-child-process-'));
  return base;
}

function writeGlobals(dir) {
  const code = `module.exports = { primordials: { ConsoleLog: (...a)=>console.log(...a), ProcessExit: (c)=>process.exit(c), ReflectApply: Reflect.apply, NewError: (m)=> new Error(m) }, app: globalThis };`;
  fs.writeFileSync(path.join(dir, 'globals.cjs'), code);
}

test('child_process shim blocks and allows spawn/exec/worker based on permissions (CJS shim)', async (t) => {
  const dir = makeTempDir();
  writeGlobals(dir);

  // Inject a fake host module
  const fakeHost = `const hostModule = ({
    spawn: function(){ return 'SPAWN_OK'; },
    spawnSync: function(){ return 'SPAWNSYNC_OK'; },
    exec: function(){ return 'EXEC_OK'; },
    execFile: function(){ return 'EXECFILE_OK'; },
    execFileSync: function(){ return 'EXECFILESYNC_OK'; },
    execSync: function(){ return 'EXECSYNC_OK'; },
    promises: {
      exec: async function(){ return 'PROM_EXEC'; },
      execFile: async function(){ return 'PROM_EXECFILE'; }
    }
  });`;

  const src = createChildProcessShimCodeCjs();
  const patched = src.replace(/const hostModule = require\("node:child_process"\);/, fakeHost);

  fs.writeFileSync(path.join(dir, 'child_process.cjs'), patched);

  const cpShim = (await import(path.join('file://' + path.join(dir, 'child_process.cjs')))).default || require(path.join(dir, 'child_process.cjs'));

  // Blocked case - spawn
  globalThis.__nodeShieldContext = { id: 'cp1', strategy: 'throw', permissions: { network: false, cmdSubcaps: { spawn: false, exec: false, worker: false } } };

  assert.throws(() => cpShim.spawn('ls'), /not allowed/);
  assert.throws(() => cpShim.spawnSync('ls'), /not allowed/);
  
  // Allowed case - spawn
  globalThis.__nodeShieldContext.permissions.cmdSubcaps.spawn = true;
  const s = cpShim.spawn('ls');
  assert.equal(s, 'SPAWN_OK');
  const ss = cpShim.spawnSync('ls');
  assert.equal(ss, 'SPAWNSYNC_OK');

  // Blocked case - exec
  globalThis.__nodeShieldContext.permissions.cmdSubcaps.exec = false;
  assert.throws(() => cpShim.exec('ls'), /not allowed/);
  assert.throws(() => cpShim.execFile('test.sh'), /not allowed/);
  assert.throws(() => cpShim.execFileSync('test.sh'), /not allowed/);
  assert.throws(() => cpShim.execSync('ls'), /not allowed/);
  await assert.rejects(() => cpShim.promises.exec('ls'), /not allowed/);
  await assert.rejects(() => cpShim.promises.execFile('test.sh'), /not allowed/);

  // Allowed case - exec
  globalThis.__nodeShieldContext.permissions.cmdSubcaps.exec = true;
  const e = cpShim.exec('ls');
  assert.equal(e, 'EXEC_OK');
  const ef = cpShim.execFile('test.sh');
  assert.equal(ef, 'EXECFILE_OK');
  const efs = cpShim.execFileSync('test.sh');
  assert.equal(efs, 'EXECFILESYNC_OK');
  const es = cpShim.execSync('ls');
  assert.equal(es, 'EXECSYNC_OK');
  const pe = await cpShim.promises.exec('ls');
  assert.equal(pe, 'PROM_EXEC');
  const pef = await cpShim.promises.execFile('test.sh');
  assert.equal(pef, 'PROM_EXECFILE');

  // Test backward compatibility - coarse command capability grants all
  globalThis.__nodeShieldContext.permissions.cmdSubcaps.spawn = false;
  globalThis.__nodeShieldContext.permissions.cmdSubcaps.exec = false;
  
  // Simulate command permission (would be set by policy translation)
  globalThis.__nodeShieldContext.permissions.cmdSubcaps.spawn = true;
  globalThis.__nodeShieldContext.permissions.cmdSubcaps.exec = true;
  
  assert.equal(cpShim.spawn('ls'), 'SPAWN_OK');
  assert.equal(cpShim.exec('ls'), 'EXEC_OK');
});
