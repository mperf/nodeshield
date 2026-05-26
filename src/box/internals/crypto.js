const explanation = `
/// Shim for 'node:crypto'. Wraps crypto methods so each call
/// can be checked against the active box permissions.
`;

function makeRuntimeCommon() {
  return `
const globals = require("./globals.cjs");
const host = require("node:crypto");
const primordials = globals.primordials;

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

module.exports.createCryptoShim = function(context) {

  function reportViolation(what) {
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

  function wrapMethod(target, name, checkFn, what) {
    const fn = target[name];
    if (typeof fn !== "function") return fn; // Safely ignore missing methods
    return function wrapped() {
      if (!checkFn(context.permissions || {})) {
        return reportViolation(what || ("crypto." + name + "()"));
      }
      return primordials.ReflectApply(fn, target, arguments);
    };
  }

  const out = Object.create(null);

  // --- Random APIs ---
  out.randomBytes = wrapMethod(host, "randomBytes", isRandomAllowed, "crypto.randomBytes");
  out.pseudoRandomBytes = wrapMethod(host, "pseudoRandomBytes", isRandomAllowed, "crypto.pseudoRandomBytes");
  out.randomFillSync = wrapMethod(host, "randomFillSync", isRandomAllowed, "crypto.randomFillSync");
  out.randomFill = wrapMethod(host, "randomFill", isRandomAllowed, "crypto.randomFill");
  out.randomUUID = wrapMethod(host, "randomUUID", isRandomAllowed, "crypto.randomUUID");

  // --- Hash APIs ---
  out.createHash = wrapMethod(host, "createHash", isHashAllowed, "crypto.createHash");
  out.createHmac = wrapMethod(host, "createHmac", isHashAllowed, "crypto.createHmac");

  // --- Key generation / key utilities ---
  out.generateKeyPair = wrapMethod(host, "generateKeyPair", isKeyAllowed, "crypto.generateKeyPair");
  out.generateKeyPairSync = wrapMethod(host, "generateKeyPairSync", isKeyAllowed, "crypto.generateKeyPairSync");
  out.generateKey = wrapMethod(host, "generateKey", isKeyAllowed, "crypto.generateKey");
  out.createSecretKey = wrapMethod(host, "createSecretKey", isKeyAllowed, "crypto.createSecretKey");
  out.createPublicKey = wrapMethod(host, "createPublicKey", isKeyAllowed, "crypto.createPublicKey");
  out.createPrivateKey = wrapMethod(host, "createPrivateKey", isKeyAllowed, "crypto.createPrivateKey");

  // --- Crypto operations ---
  out.sign = wrapMethod(host, "sign", isCryptoOpsAllowed, "crypto.sign");
  out.verify = wrapMethod(host, "verify", isCryptoOpsAllowed, "crypto.verify");
  out.publicEncrypt = wrapMethod(host, "publicEncrypt", isCryptoOpsAllowed, "crypto.publicEncrypt");
  out.privateDecrypt = wrapMethod(host, "privateDecrypt", isCryptoOpsAllowed, "crypto.privateDecrypt");
  out.createCipher = wrapMethod(host, "createCipher", isCryptoOpsAllowed, "crypto.createCipher");
  out.createDecipher = wrapMethod(host, "createDecipher", isCryptoOpsAllowed, "crypto.createDecipher");
  out.createCipheriv = wrapMethod(host, "createCipheriv", isCryptoOpsAllowed, "crypto.createCipheriv");
  out.createDecipheriv = wrapMethod(host, "createDecipheriv", isCryptoOpsAllowed, "crypto.createDecipheriv");

  // Subtle (WebCrypto) — wrap when present
  if (host.webcrypto && host.webcrypto.subtle) {
    const subtle = host.webcrypto.subtle;
    const subtleWrap = Object.create(null);
    subtleWrap.digest = function() { if (!isHashAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.digest()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.digest, subtle, arguments); };
    subtleWrap.generateKey = function() { if (!isKeyAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.generateKey()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.generateKey, subtle, arguments); };
    subtleWrap.sign = function() { if (!isCryptoOpsAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.sign()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.sign, subtle, arguments); };
    subtleWrap.verify = function() { if (!isCryptoOpsAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.verify()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.verify, subtle, arguments); };
    subtleWrap.encrypt = function() { if (!isCryptoOpsAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.encrypt()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.encrypt, subtle, arguments); };
    subtleWrap.decrypt = function() { if (!isCryptoOpsAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.decrypt()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.decrypt, subtle, arguments); };
    subtleWrap.deriveKey = function() { if (!isKeyAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.deriveKey()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.deriveKey, subtle, arguments); };
    subtleWrap.deriveBits = function() { if (!isKeyAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.deriveBits()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.deriveBits, subtle, arguments); };
    subtleWrap.wrapKey = function() { if (!isKeyAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.wrapKey()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.wrapKey, subtle, arguments); };
    subtleWrap.unwrapKey = function() { if (!isKeyAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.unwrapKey()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.unwrapKey, subtle, arguments); };
    out.webcrypto = Object.freeze({ subtle: Object.freeze(subtleWrap) });
  }

  // Copy other properties conservatively
  Object.getOwnPropertyNames(host).forEach((k) => {
    if (!(k in out)) out[k] = host[k];
  });

  return Object.freeze(out);
};
`;
}

function makeRuntimeCommonEsm() {
  return `
import globals from "./globals.cjs";
import * as host from "node:crypto";
const primordials = globals.primordials;

function isRandomAllowed(perms) { if (!perms) return false; if (perms.crypto) return true; const sub = perms.cryptoSubcaps || {}; return !!sub.random; }
function isHashAllowed(perms) { if (!perms) return false; if (perms.crypto) return true; const sub = perms.cryptoSubcaps || {}; return !!sub.hash; }
function isKeyAllowed(perms) { if (!perms) return false; if (perms.crypto) return true; const sub = perms.cryptoSubcaps || {}; return !!sub.key; }
function isCryptoOpsAllowed(perms) { if (!perms) return false; if (perms.crypto) return true; const sub = perms.cryptoSubcaps || {}; return !!sub.cryptoops; }

export function createCryptoShim(context) {

  function reportViolation(what) {
    const strategy = context.strategy || "throw";
    const message = "using '" + what + "' is not allowed in " + (context.id || "unknown");
    if (strategy === "log") { primordials.ConsoleLog("[V] " + message); return true; }
    if (strategy === "exit") { primordials.ConsoleLog("[V] " + message); primordials.ProcessExit(42); }
    throw primordials.NewError(message);
  }

  function wrapMethod(target, name, checkFn, what) { 
    const fn = target[name]; 
    if (typeof fn !== "function") return fn; 
    return function wrapped() { 
      if (!checkFn(context.permissions || {})) { 
        return reportViolation(what || ("crypto." + name + "()")); 
      } 
      return primordials.ReflectApply(fn, target, arguments); 
    }; 
  }

  const out = Object.create(null);
  
  // --- Random APIs ---
  out.randomBytes = wrapMethod(host, "randomBytes", isRandomAllowed, "crypto.randomBytes");
  out.pseudoRandomBytes = wrapMethod(host, "pseudoRandomBytes", isRandomAllowed, "crypto.pseudoRandomBytes");
  out.randomFillSync = wrapMethod(host, "randomFillSync", isRandomAllowed, "crypto.randomFillSync");
  out.randomFill = wrapMethod(host, "randomFill", isRandomAllowed, "crypto.randomFill");
  out.randomUUID = wrapMethod(host, "randomUUID", isRandomAllowed, "crypto.randomUUID");

  // --- Hash APIs ---
  out.createHash = wrapMethod(host, "createHash", isHashAllowed, "crypto.createHash");
  out.createHmac = wrapMethod(host, "createHmac", isHashAllowed, "crypto.createHmac");

  // --- Key generation / key utilities ---
  out.generateKeyPair = wrapMethod(host, "generateKeyPair", isKeyAllowed, "crypto.generateKeyPair");
  out.generateKeyPairSync = wrapMethod(host, "generateKeyPairSync", isKeyAllowed, "crypto.generateKeyPairSync");
  out.generateKey = wrapMethod(host, "generateKey", isKeyAllowed, "crypto.generateKey");
  out.createSecretKey = wrapMethod(host, "createSecretKey", isKeyAllowed, "crypto.createSecretKey");
  out.createPublicKey = wrapMethod(host, "createPublicKey", isKeyAllowed, "crypto.createPublicKey");
  out.createPrivateKey = wrapMethod(host, "createPrivateKey", isKeyAllowed, "crypto.createPrivateKey");

  // --- Crypto operations ---
  out.sign = wrapMethod(host, "sign", isCryptoOpsAllowed, "crypto.sign");
  out.verify = wrapMethod(host, "verify", isCryptoOpsAllowed, "crypto.verify");
  out.publicEncrypt = wrapMethod(host, "publicEncrypt", isCryptoOpsAllowed, "crypto.publicEncrypt");
  out.privateDecrypt = wrapMethod(host, "privateDecrypt", isCryptoOpsAllowed, "crypto.privateDecrypt");
  out.createCipher = wrapMethod(host, "createCipher", isCryptoOpsAllowed, "crypto.createCipher");
  out.createDecipher = wrapMethod(host, "createDecipher", isCryptoOpsAllowed, "crypto.createDecipher");
  out.createCipheriv = wrapMethod(host, "createCipheriv", isCryptoOpsAllowed, "crypto.createCipheriv");
  out.createDecipheriv = wrapMethod(host, "createDecipheriv", isCryptoOpsAllowed, "crypto.createDecipheriv");
  
  if (host.webcrypto && host.webcrypto.subtle) {
    const subtle = host.webcrypto.subtle;
    const subtleWrap = {};
    subtleWrap.digest = function() { if (!isHashAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.digest()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.digest, subtle, arguments); };
    subtleWrap.generateKey = function() { if (!isKeyAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.generateKey()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.generateKey, subtle, arguments); };
    subtleWrap.sign = function() { if (!isCryptoOpsAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.sign()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.sign, subtle, arguments); };
    subtleWrap.verify = function() { if (!isCryptoOpsAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.verify()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.verify, subtle, arguments); };
    subtleWrap.encrypt = function() { if (!isCryptoOpsAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.encrypt()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.encrypt, subtle, arguments); };
    subtleWrap.decrypt = function() { if (!isCryptoOpsAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.decrypt()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.decrypt, subtle, arguments); };
    subtleWrap.deriveKey = function() { if (!isKeyAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.deriveKey()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.deriveKey, subtle, arguments); };
    subtleWrap.deriveBits = function() { if (!isKeyAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.deriveBits()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.deriveBits, subtle, arguments); };
    subtleWrap.wrapKey = function() { if (!isKeyAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.wrapKey()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.wrapKey, subtle, arguments); };
    subtleWrap.unwrapKey = function() { if (!isKeyAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'crypto.subtle.unwrapKey()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(subtle.unwrapKey, subtle, arguments); };
    out.webcrypto = Object.freeze({ subtle: Object.freeze(subtleWrap) });
  }

  Object.getOwnPropertyNames(host).forEach((k) => { if (!(k in out)) out[k] = host[k]; });

  // Bind the default export so ESM default imports work properly
  out.default = out;
  return Object.freeze(out);
}
`;
}

export function createCryptoShimCodeCjs() {
  return `${explanation}\n\n${makeRuntimeCommon()}`;
}

export function createCryptoShimCodeEsm() {
  return `${explanation}\n\n${makeRuntimeCommonEsm()}`;
}