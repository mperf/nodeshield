import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createDnsShimCodeCjs } from '../../src/box/internals/dns.js';

function makeTempDir() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nodeshield-dns-'));
  return base;
}

function writeGlobals(dir) {
  const code = `module.exports = { primordials: { ConsoleLog: (...a)=>console.log(...a), ProcessExit: (c)=>process.exit(c), ReflectApply: Reflect.apply, NewError: (m)=> new Error(m) }, app: globalThis };`;
  fs.writeFileSync(path.join(dir, 'globals.cjs'), code);
}

test('dns shim blocks and allows based on permissions (CJS shim)', async (t) => {
  const dir = makeTempDir();
  writeGlobals(dir);

  // Inject a fake host module object so tests don't perform real DNS
  const fakeHost = `const hostModule = ({ lookup: function(){ return 'LOOKUP_OK'; }, resolve: function(){ return 'RESOLVE_OK'; }, resolve4: function(){ return 'RES4'; }, resolve6: function(){ return 'RES6'; }, promises: { lookup: async function(){ return 'PROM_LOOKUP'; }, resolve: async function(){ return 'PROM_RESOLVE'; } } });`;

  const src = createDnsShimCodeCjs();
  const patched = src.replace(/const hostModule = require\("node:dns"\);/, fakeHost);

  fs.writeFileSync(path.join(dir, 'dns.cjs'), patched);

  // Ensure we load the local globals.cjs from the same dir
  const dnsShim = (await import(path.join('file://' + path.join(dir, 'dns.cjs')))).default || require(path.join(dir, 'dns.cjs'));

  // Blocked case
  globalThis.__nodeShieldContext = { id: 't1', strategy: 'throw', permissions: { network: false, networkSubcaps: { dns: false } } };

  assert.throws(() => dnsShim.lookup('example.com'), /not allowed/);
  await assert.rejects(() => dnsShim.promises.lookup('example.com'), /not allowed/);

  // Allowed case
  globalThis.__nodeShieldContext.permissions.networkSubcaps.dns = true;

  const r = dnsShim.lookup('example.com');
  assert.equal(r, 'LOOKUP_OK');

  const pr = await dnsShim.promises.lookup('example.com');
  assert.equal(pr, 'PROM_LOOKUP');
});
