const explanation = `
/// Shim for 'node:crypto'. Wraps crypto methods so each call
/// can be checked against the active box permissions.
`;

function makeRuntimeCommon() {
  return `
const globals = require("./globals.cjs");
const host = require("node:crypto");
const primordials = globals.primordials;
const app = globals.app;

function getContext() {
  return app.__nodeShieldContext || { id: "unknown", strategy: "throw", permissions: { crypto: false, cryptoSubcaps: { random: false, hash: false, key: false, cryptoops: false } } };
}

function reportViolation(what) {
  const context = getContext();
  const strategy = context.strategy || "throw";
  const message = "using '" + what + "' is not allowed in " + (context.id || "unknown");

  if (strategy === "log") {
    primordials.ConsoleLog("[V] " + message);
    return true;
  }

  if (strategy === "exit") {
    primordials.ConsoleLog("[V] " + message);
    primordials.ProcessExit(42);
  }

  throw primordials.NewError(message);
}

function isRandomAllowed(perms) {
  if (!perms) return false;
  if (perms.crypto) return true;
  const sub = perms.cryptoSubcaps || {};
  return !!sub.random;
}

function isHashAllowed(perms) {
  if (!perms) return false;
  if (perms.crypto) return true;
  const sub = perms.cryptoSubcaps || {};
  return !!sub.hash;
}

function isKeyAllowed(perms) {
  if (!perms) return false;
  if (perms.crypto) return true;
  const sub = perms.cryptoSubcaps || {};
  return !!sub.key;
}

function isCryptoOpsAllowed(perms) {
  if (!perms) return false;
  if (perms.crypto) return true;
  const sub = perms.cryptoSubcaps || {};
  return !!sub.cryptoops;
}

function wrapMethod(target, name, checkFn, what) {
  const fn = target[name];
  if (typeof fn !== "function") return fn;
  return function wrapped() {
    const context = getContext();
    if (!checkFn(context.permissions || {})) {
      return reportViolation(what || ("crypto." + name + "()"));
    }
    return primordials.ReflectApply(fn, target, arguments);
  };
}

const out = Object.create(null);

// Random APIs
out.randomBytes = wrapMethod(host, "randomBytes", isRandomAllowed, "crypto.randomBytes");
out.randomFillSync = wrapMethod(host, "randomFillSync", isRandomAllowed, "crypto.randomFillSync");
out.randomFill = wrapMethod(host, "randomFill", isRandomAllowed, "crypto.randomFill");
out.randomUUID = wrapMethod(host, "randomUUID", isRandomAllowed, "crypto.randomUUID");

// Hash APIs
out.createHash = wrapMethod(host, "createHash", isHashAllowed, "crypto.createHash");
out.createHmac = wrapMethod(host, "createHmac", isHashAllowed, "crypto.createHmac");

// Key generation / key utilities
out.generateKeyPair = wrapMethod(host, "generateKeyPair", isKeyAllowed, "crypto.generateKeyPair");
out.generateKeyPairSync = wrapMethod(host, "generateKeyPairSync", isKeyAllowed, "crypto.generateKeyPairSync");
out.generateKey = wrapMethod(host, "generateKey", isKeyAllowed, "crypto.generateKey");

// Crypto operations
out.sign = wrapMethod(host, "sign", isCryptoOpsAllowed, "crypto.sign");
out.verify = wrapMethod(host, "verify", isCryptoOpsAllowed, "crypto.verify");
out.publicEncrypt = wrapMethod(host, "publicEncrypt", isCryptoOpsAllowed, "crypto.publicEncrypt");
out.privateDecrypt = wrapMethod(host, "privateDecrypt", isCryptoOpsAllowed, "crypto.privateDecrypt");

// Subtle (WebCrypto) — wrap when present
if (host.webcrypto && host.webcrypto.subtle) {
  const subtle = host.webcrypto.subtle;
  const subtleWrap = Object.create(null);
  subtleWrap.digest = function() { const ctx = getContext(); if (!isHashAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.digest()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.digest, subtle, arguments); };
  subtleWrap.generateKey = function() { const ctx = getContext(); if (!isKeyAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.generateKey()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.generateKey, subtle, arguments); };
  subtleWrap.sign = function() { const ctx = getContext(); if (!isCryptoOpsAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.sign()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.sign, subtle, arguments); };
  subtleWrap.verify = function() { const ctx = getContext(); if (!isCryptoOpsAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.verify()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.verify, subtle, arguments); };
  subtleWrap.encrypt = function() { const ctx = getContext(); if (!isCryptoOpsAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.encrypt()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.encrypt, subtle, arguments); };
  subtleWrap.decrypt = function() { const ctx = getContext(); if (!isCryptoOpsAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.decrypt()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.decrypt, subtle, arguments); };
  subtleWrap.deriveKey = function() { const ctx = getContext(); if (!isKeyAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.deriveKey()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.deriveKey, subtle, arguments); };
  subtleWrap.deriveBits = function() { const ctx = getContext(); if (!isKeyAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.deriveBits()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.deriveBits, subtle, arguments); };
  subtleWrap.wrapKey = function() { const ctx = getContext(); if (!isKeyAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.wrapKey()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.wrapKey, subtle, arguments); };
  subtleWrap.unwrapKey = function() { const ctx = getContext(); if (!isKeyAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.unwrapKey()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.unwrapKey, subtle, arguments); };
  out.webcrypto = Object.freeze({ subtle: Object.freeze(subtleWrap) });
}

// Copy other properties conservatively
Object.getOwnPropertyNames(host).forEach((k) => {
  if (!(k in out)) out[k] = host[k];
});

module.exports = Object.freeze(out);
`;
}

function makeRuntimeCommonEsm() {
  return `
import globals from "./globals.cjs";
import * as host from "node:crypto";
const primordials = globals.primordials;
const app = globals.app;

function getContext() { return app.__nodeShieldContext || { id: "unknown", strategy: "throw", permissions: { crypto: false, cryptoSubcaps: { random: false, hash: false, key: false, cryptoops: false } } }; }
function reportViolation(what) {
  const context = getContext();
  const strategy = context.strategy || "throw";
  const message = "using '" + what + "' is not allowed in " + (context.id || "unknown");
  if (strategy === "log") { primordials.ConsoleLog("[V] " + message); return true; }
  if (strategy === "exit") { primordials.ConsoleLog("[V] " + message); primordials.ProcessExit(42); }
  throw primordials.NewError(message);
}
function isRandomAllowed(perms) { if (!perms) return false; if (perms.crypto) return true; const sub = perms.cryptoSubcaps || {}; return !!sub.random; }
function isHashAllowed(perms) { if (!perms) return false; if (perms.crypto) return true; const sub = perms.cryptoSubcaps || {}; return !!sub.hash; }
function isKeyAllowed(perms) { if (!perms) return false; if (perms.crypto) return true; const sub = perms.cryptoSubcaps || {}; return !!sub.key; }
function isCryptoOpsAllowed(perms) { if (!perms) return false; if (perms.crypto) return true; const sub = perms.cryptoSubcaps || {}; return !!sub.cryptoops; }
function wrapMethod(target, name, checkFn, what) { const fn = target[name]; if (typeof fn !== "function") return fn; return function wrapped() { const context = getContext(); if (!checkFn(context.permissions || {})) { return reportViolation(what || ("crypto." + name + "()")); } return primordials.ReflectApply(fn, target, arguments); }; }

const out = Object.create(null);
out.randomBytes = wrapMethod(host, "randomBytes", isRandomAllowed, "crypto.randomBytes");
out.randomFillSync = wrapMethod(host, "randomFillSync", isRandomAllowed, "crypto.randomFillSync");
out.randomFill = wrapMethod(host, "randomFill", isRandomAllowed, "crypto.randomFill");
out.randomUUID = wrapMethod(host, "randomUUID", isRandomAllowed, "crypto.randomUUID");
out.createHash = wrapMethod(host, "createHash", isHashAllowed, "crypto.createHash");
out.createHmac = wrapMethod(host, "createHmac", isHashAllowed, "crypto.createHmac");
out.generateKeyPair = wrapMethod(host, "generateKeyPair", isKeyAllowed, "crypto.generateKeyPair");
out.generateKeyPairSync = wrapMethod(host, "generateKeyPairSync", isKeyAllowed, "crypto.generateKeyPairSync");
out.generateKey = wrapMethod(host, "generateKey", isKeyAllowed, "crypto.generateKey");
out.sign = wrapMethod(host, "sign", isCryptoOpsAllowed, "crypto.sign");
out.verify = wrapMethod(host, "verify", isCryptoOpsAllowed, "crypto.verify");
out.publicEncrypt = wrapMethod(host, "publicEncrypt", isCryptoOpsAllowed, "crypto.publicEncrypt");
out.privateDecrypt = wrapMethod(host, "privateDecrypt", isCryptoOpsAllowed, "crypto.privateDecrypt");
if (host.webcrypto && host.webcrypto.subtle) {
  const subtle = host.webcrypto.subtle;
  const subtleWrap = {};
  subtleWrap.digest = function() { const ctx = getContext(); if (!isHashAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.digest()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.digest, subtle, arguments); };
  subtleWrap.generateKey = function() { const ctx = getContext(); if (!isKeyAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.generateKey()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.generateKey, subtle, arguments); };
  subtleWrap.sign = function() { const ctx = getContext(); if (!isCryptoOpsAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.sign()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.sign, subtle, arguments); };
  subtleWrap.verify = function() { const ctx = getContext(); if (!isCryptoOpsAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.verify()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.verify, subtle, arguments); };
  subtleWrap.encrypt = function() { const ctx = getContext(); if (!isCryptoOpsAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.encrypt()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.encrypt, subtle, arguments); };
  subtleWrap.decrypt = function() { const ctx = getContext(); if (!isCryptoOpsAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.decrypt()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.decrypt, subtle, arguments); };
  subtleWrap.deriveKey = function() { const ctx = getContext(); if (!isKeyAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.deriveKey()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.deriveKey, subtle, arguments); };
  subtleWrap.deriveBits = function() { const ctx = getContext(); if (!isKeyAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.deriveBits()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.deriveBits, subtle, arguments); };
  subtleWrap.wrapKey = function() { const ctx = getContext(); if (!isKeyAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.wrapKey()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.wrapKey, subtle, arguments); };
  subtleWrap.unwrapKey = function() { const ctx = getContext(); if (!isKeyAllowed(ctx.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.unwrapKey()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(subtle.unwrapKey, subtle, arguments); };
  out.webcrypto = Object.freeze({ subtle: Object.freeze(subtleWrap) });
}

Object.getOwnPropertyNames(host).forEach((k) => { if (!(k in out)) out[k] = host[k]; });

export default Object.freeze(out);
`;
}

export function createCryptoShimCodeCjs() {
	return `${explanation}\n\n${makeRuntimeCommon()}`;
}

export function createCryptoShimCodeEsm() {
	return `${explanation}\n\n${makeRuntimeCommonEsm()}`;
}
