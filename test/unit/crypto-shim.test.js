import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createCryptoShimCodeCjs } from '../../src/box/internals/crypto.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nodeshield-crypto-'));
}

function writeGlobals(dir) {
  const code = `module.exports = { primordials: { ConsoleLog: (...a)=>console.log(...a), ProcessExit: (c)=>process.exit(c), ReflectApply: Reflect.apply, NewError: (m)=> new Error(m) }, app: globalThis };`;
  fs.writeFileSync(path.join(dir, 'globals.cjs'), code);
}

test('crypto shim blocks and allows random/hash/key/ops based on permissions (CJS shim)', async (t) => {
  const dir = makeTempDir();
  writeGlobals(dir);

  const fakeHost = `const host = ({
    randomBytes: function(n){ return Buffer.alloc(n, 42); },
    randomUUID: function(){ return 'UUID'; },
    createHash: function(){ return 'HASH'; },
    createHmac: function(){ return 'HMAC'; },
    generateKeyPair: function(){ return 'GENKEY'; },
    sign: function(){ return 'SIGNED'; },
    verify: function(){ return true;
    }
  });`;

  const src = createCryptoShimCodeCjs();
  const patched = src.replace(/const host = require\\("node:crypto"\\);/, fakeHost);
  fs.writeFileSync(path.join(dir, 'crypto.cjs'), patched);

  const cpShim = (await import(path.join('file://' + path.join(dir, 'crypto.cjs')))).default || require(path.join(dir, 'crypto.cjs'));

  globalThis.__nodeShieldContext = { id: 'c1', strategy: 'throw', permissions: { crypto: false, cryptoSubcaps: { random: false, hash: false, key: false, cryptoops: false } } };

  // blocked
  assert.throws(() => cpShim.randomBytes(2), /not allowed/);
  assert.throws(() => cpShim.createHash('sha256'), /not allowed/);
  assert.throws(() => cpShim.generateKeyPair('rsa', {}), /not allowed/);
  assert.throws(() => cpShim.sign('sha256', 'data'), /not allowed/);

  // allow random
  globalThis.__nodeShieldContext.permissions.cryptoSubcaps.random = true;
  const rb = cpShim.randomBytes(2);
  assert.equal(Buffer.isBuffer(rb), true);
  const uuid = cpShim.randomUUID();
  assert.equal(typeof uuid, 'string');

  // allow hash
  globalThis.__nodeShieldContext.permissions.cryptoSubcaps.hash = true;
  const h = cpShim.createHash('sha256');
  assert.ok(h != null);

  // backward compat: coarse crypto grants all
  globalThis.__nodeShieldContext.permissions = { crypto: true, cryptoSubcaps: { random: false, hash: false, key: false, cryptoops: false } };
  assert.equal(Buffer.isBuffer(cpShim.randomBytes(1)), true);
  assert.ok(cpShim.createHash('md5') != null);
});
