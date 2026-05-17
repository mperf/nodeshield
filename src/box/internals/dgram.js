const explanation = `
/// Shim for 'node:dgram'. Guards socket creation so UDP usage is controlled
/// by the box permissions.
`;

function makeRuntimeCommon() {
  return `
const globals = require("./globals.cjs");
const hostModule = require("node:dgram");

const primordials = globals.primordials;
const app = globals.app;

function getContext() {
  return app.__nodeShieldContext || {
    id: "unknown",
    strategy: "throw",
    permissions: {
      network: false,
      networkSubcaps: {
        udp: false,
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
  const networkSubcaps = (permissions || {}).networkSubcaps || { udp: false };
  return !!networkSubcaps.udp;
}

function wrapCreateSocket() {
  const fn = hostModule.createSocket;
  return function wrapped(...args) {
    const context = getContext();
    if (!isAllowed(context.permissions || {})) {
      return reportViolation('dgram.createSocket()');
    }
    return primordials.ReflectApply(fn, hostModule, args);
  };
}

const hostDgramModule = Object.assign(Object.create(null), Object.getOwnPropertyNames(hostModule).reduce((acc, k) => {
  acc[k] = hostModule[k];
  return acc;
}, {}));

hostDgramModule.createSocket = wrapCreateSocket();

module.exports = Object.freeze(hostDgramModule);
`;
}

function makeRuntimeCommonEsm() {
  return `
import globals from "./globals.cjs";
import * as hostModule from "node:dgram";

const primordials = globals.primordials;
const app = globals.app;

function getContext() {
  return app.__nodeShieldContext || {
    id: "unknown",
    strategy: "throw",
    permissions: {
      network: false,
      networkSubcaps: {
        udp: false,
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
  const networkSubcaps = (permissions || {}).networkSubcaps || { udp: false };
  return !!networkSubcaps.udp;
}

function wrapCreateSocket(target) {
  const fn = target.createSocket;
  return function wrapped(...args) {
    const context = getContext();
    if (!isAllowed(context.permissions || {})) {
      return reportViolation('dgram.createSocket()');
    }
    return primordials.ReflectApply(fn, target, args);
  };
}

const hostDgramModule = Object.assign(Object.create(null), {
  ...hostModule,
});

hostDgramModule.createSocket = wrapCreateSocket(hostModule);

export default Object.freeze(hostDgramModule);
`;
}

export function createDgramShimCodeCjs() {
  return `${explanation}\n\n${makeRuntimeCommon()}`;
}

export function createDgramShimCodeEsm() {
  return `${explanation}\n\n${makeRuntimeCommonEsm()}`;
}
