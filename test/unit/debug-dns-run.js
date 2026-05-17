const fs = require('fs');
const path = require('path');
const os = require('os');

const { createDnsShimCodeCjs } = require('../../src/box/internals/dns.js');

function makeTempDir() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nodeshield-dns-'));
  return base;
}

function writeGlobals(dir) {
  const code = `module.exports = { primordials: { ConsoleLog: (...a)=>console.log(...a), ProcessExit: (c)=>process.exit(c), ReflectApply: Reflect.apply, NewError: (m)=> new Error(m) }, app: globalThis };`;
  fs.writeFileSync(path.join(dir, 'globals.cjs'), code);
}

async function main(){
  const dir = makeTempDir();
  writeGlobals(dir);
  const src = createDnsShimCodeCjs();
  const fakeHost = `const hostModule = ({ lookup: function(){ return 'LOOKUP_OK'; }, resolve: function(){ return 'RESOLVE_OK'; }, promises: { lookup: async function(){ return 'PROM_LOOKUP'; } } });`;
  const patched = src.replace(/const hostModule = require\("node:dns"\);/, fakeHost);
  const file = path.join(dir, 'dns.cjs');
  fs.writeFileSync(file, patched);
  console.log('\n--- Generated dns.cjs ---\n');
  console.log(patched);

  global.__nodeShieldContext = { id: 'dbg', strategy: 'throw', permissions: { network: false, networkSubcaps: { dns: false } } };

  const dnsShim = require(file);
  console.log('dnsShim.lookup type =', typeof dnsShim.lookup);
  try {
    const r = dnsShim.lookup('example.com');
    console.log('lookup returned:', r);
  } catch (e) {
    console.error('lookup threw:', e && e.message);
  }

  try {
    dnsShim.promises.lookup('example.com').then(r => console.log('promises.lookup resolved:', r)).catch(e => console.error('promises.lookup threw:', e && e.message));
  } catch (e) {
    console.error('promises.lookup sync threw:', e && e.message);
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
