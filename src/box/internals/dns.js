const explanation = `
/// Shim for 'node:dns'. Wraps common lookup/resolve functions so each call
/// can be checked against the active box permissions.
`;

function makeRuntimeCommon() {
  return `
const globals = require("./globals.cjs");
const hostModule = require("node:dns");

const primordials = globals.primordials;
const app = globals.app;

function getContext() {
  return app.__nodeShieldContext || {
    id: "unknown",
    strategy: "throw",
    permissions: {
      network: false,
      networkSubcaps: {
        dns: false,
      },
    },
  };
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

function isAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const networkSubcaps = (permissions || {}).networkSubcaps || { dns: false };
  return !!networkSubcaps.dns;
}

function wrapCall(fnName) {
  const fn = hostModule[fnName];
  if (typeof fn !== 'function') return fn;
  return function wrapped(...args) {
    const context = getContext();
    if (!isAllowed(context.permissions || {})) {
      return reportViolation('dns.' + fnName + "()");
    }
    return primordials.ReflectApply(fn, hostModule, args);
  };
}

const hostDnsModule = Object.assign(Object.create(null), Object.getOwnPropertyNames(hostModule).reduce((acc, k) => {
  acc[k] = hostModule[k];
  return acc;
}, {}));

// Wrap common call sites
hostDnsModule.lookup = wrapCall('lookup');
hostDnsModule.resolve = wrapCall('resolve');
hostDnsModule.resolve4 = wrapCall('resolve4');
hostDnsModule.resolve6 = wrapCall('resolve6');

// promises sub-object
if (hostModule.promises) {
  const p = hostModule.promises;
  hostDnsModule.promises = Object.freeze({
    lookup: function() { const context = getContext(); if (!isAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'dns.promises.lookup()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(p.lookup, p, arguments); },
    resolve: function() { const context = getContext(); if (!isAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'dns.promises.resolve()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(p.resolve, p, arguments); },
  });
}

module.exports = Object.freeze(hostDnsModule);
`;
}

function makeRuntimeCommonEsm() {
  return `
import globals from "./globals.cjs";
import * as hostModule from "node:dns";

const primordials = globals.primordials;
const app = globals.app;

function getContext() {
  return app.__nodeShieldContext || {
    id: "unknown",
    strategy: "throw",
    permissions: {
      network: false,
      networkSubcaps: {
        dns: false,
      },
    },
  };
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

function isAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const networkSubcaps = (permissions || {}).networkSubcaps || { dns: false };
  return !!networkSubcaps.dns;
}

function wrapCall(target, fnName) {
  const fn = target[fnName];
  if (typeof fn !== 'function') return fn;
  return function wrapped(...args) {
    const context = getContext();
    if (!isAllowed(context.permissions || {})) {
      return reportViolation('dns.' + fnName + "()");
    }
    return primordials.ReflectApply(fn, target, args);
  };
}

const hostDnsModule = Object.assign(Object.create(null), {
  ...hostModule,
});

// Wrap common call sites
hostDnsModule.lookup = wrapCall(hostModule, 'lookup');
hostDnsModule.resolve = wrapCall(hostModule, 'resolve');
hostDnsModule.resolve4 = wrapCall(hostModule, 'resolve4');
hostDnsModule.resolve6 = wrapCall(hostModule, 'resolve6');

if (hostModule.promises) {
  const p = hostModule.promises;
  hostDnsModule.promises = Object.freeze({
    lookup: function() { const context = getContext(); if (!isAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'dns.promises.lookup()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(p.lookup, p, arguments); },
    resolve: function() { const context = getContext(); if (!isAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'dns.promises.resolve()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(p.resolve, p, arguments); },
  });
}

export default Object.freeze(hostDnsModule);
`;
}

export function createDnsShimCodeCjs() {
  return `${explanation}\n\n${makeRuntimeCommon()}`;
}

export function createDnsShimCodeEsm() {
  return `${explanation}\n\n${makeRuntimeCommonEsm()}`;
}
