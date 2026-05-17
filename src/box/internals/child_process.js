const explanation = `
/// Shim for 'node:child_process'. Wraps process execution methods so each call
/// can be checked against the active box permissions.
`;

function makeRuntimeCommon() {
  return `
const globals = require("./globals.cjs");
const hostModule = require("node:child_process");

const primordials = globals.primordials;
const app = globals.app;

function getContext() {
  return app.__nodeShieldContext || {
    id: "unknown",
    strategy: "throw",
    permissions: {
      network: false,
      cmdSubcaps: {
        spawn: false,
        exec: false,
        worker: false,
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

function isSpawnAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const cmdSubcaps = (permissions || {}).cmdSubcaps || { spawn: false };
  return !!cmdSubcaps.spawn;
}

function isExecAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const cmdSubcaps = (permissions || {}).cmdSubcaps || { exec: false };
  return !!cmdSubcaps.exec;
}

function isWorkerAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const cmdSubcaps = (permissions || {}).cmdSubcaps || { worker: false };
  return !!cmdSubcaps.worker;
}

function wrapSpawnMethod(fnName) {
  const fn = hostModule[fnName];
  if (typeof fn !== "function") return fn;
  return function wrapped(...args) {
    const context = getContext();
    if (!isSpawnAllowed(context.permissions || {})) {
      return reportViolation("child_process." + fnName + "()");
    }
    return primordials.ReflectApply(fn, hostModule, args);
  };
}

function wrapExecMethod(fnName) {
  const fn = hostModule[fnName];
  if (typeof fn !== "function") return fn;
  return function wrapped(...args) {
    const context = getContext();
    if (!isExecAllowed(context.permissions || {})) {
      return reportViolation("child_process." + fnName + "()");
    }
    return primordials.ReflectApply(fn, hostModule, args);
  };
}

function wrapWorker() {
  const HostWorker = hostModule.Worker;
  if (typeof HostWorker !== "function") return HostWorker;
  
  return function Worker(...args) {
    const context = getContext();
    if (!isWorkerAllowed(context.permissions || {})) {
      return reportViolation("worker_threads.Worker()");
    }
    return primordials.ReflectApply(HostWorker, hostModule, args);
  };
}

const hostChildProcessModule = Object.assign(Object.create(null), Object.getOwnPropertyNames(hostModule).reduce((acc, k) => {
  acc[k] = hostModule[k];
  return acc;
}, {}));

// Wrap spawn methods (cmd-spawn)
hostChildProcessModule.spawn = wrapSpawnMethod("spawn");
hostChildProcessModule.spawnSync = wrapSpawnMethod("spawnSync");

// Wrap exec methods (cmd-exec)
hostChildProcessModule.exec = wrapExecMethod("exec");
hostChildProcessModule.execFile = wrapExecMethod("execFile");
hostChildProcessModule.execFileSync = wrapExecMethod("execFileSync");
hostChildProcessModule.execSync = wrapExecMethod("execSync");

// Wrap promises sub-object for exec methods
if (hostModule.promises) {
  const p = hostModule.promises;
  hostChildProcessModule.promises = Object.freeze({
    exec: function() { const context = getContext(); if (!isExecAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'child_process.promises.exec()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(p.exec, p, arguments); },
    execFile: function() { const context = getContext(); if (!isExecAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'child_process.promises.execFile()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(p.execFile, p, arguments); },
  });
}

module.exports = Object.freeze(hostChildProcessModule);
`;
}

function makeRuntimeCommonEsm() {
  return `
import globals from "./globals.cjs";
import * as hostModule from "node:child_process";

const primordials = globals.primordials;
const app = globals.app;

function getContext() {
  return app.__nodeShieldContext || {
    id: "unknown",
    strategy: "throw",
    permissions: {
      network: false,
      cmdSubcaps: {
        spawn: false,
        exec: false,
        worker: false,
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

function isSpawnAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const cmdSubcaps = (permissions || {}).cmdSubcaps || { spawn: false };
  return !!cmdSubcaps.spawn;
}

function isExecAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const cmdSubcaps = (permissions || {}).cmdSubcaps || { exec: false };
  return !!cmdSubcaps.exec;
}

function isWorkerAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const cmdSubcaps = (permissions || {}).cmdSubcaps || { worker: false };
  return !!cmdSubcaps.worker;
}

function wrapSpawnMethod(target, fnName) {
  const fn = target[fnName];
  if (typeof fn !== "function") return fn;
  return function wrapped(...args) {
    const context = getContext();
    if (!isSpawnAllowed(context.permissions || {})) {
      return reportViolation("child_process." + fnName + "()");
    }
    return primordials.ReflectApply(fn, target, args);
  };
}

function wrapExecMethod(target, fnName) {
  const fn = target[fnName];
  if (typeof fn !== "function") return fn;
  return function wrapped(...args) {
    const context = getContext();
    if (!isExecAllowed(context.permissions || {})) {
      return reportViolation("child_process." + fnName + "()");
    }
    return primordials.ReflectApply(fn, target, args);
  };
}

function wrapWorker(target) {
  const HostWorker = target.Worker;
  if (typeof HostWorker !== "function") return HostWorker;
  
  return function Worker(...args) {
    const context = getContext();
    if (!isWorkerAllowed(context.permissions || {})) {
      return reportViolation("worker_threads.Worker()");
    }
    return primordials.ReflectApply(HostWorker, target, args);
  };
}

const hostChildProcessModule = Object.assign(Object.create(null), { ...hostModule });

// Wrap spawn methods (cmd-spawn)
hostChildProcessModule.spawn = wrapSpawnMethod(hostModule, "spawn");
hostChildProcessModule.spawnSync = wrapSpawnMethod(hostModule, "spawnSync");

// Wrap exec methods (cmd-exec)
hostChildProcessModule.exec = wrapExecMethod(hostModule, "exec");
hostChildProcessModule.execFile = wrapExecMethod(hostModule, "execFile");
hostChildProcessModule.execFileSync = wrapExecMethod(hostModule, "execFileSync");
hostChildProcessModule.execSync = wrapExecMethod(hostModule, "execSync");

// Wrap promises sub-object for exec methods
if (hostModule.promises) {
  const p = hostModule.promises;
  hostChildProcessModule.promises = Object.freeze({
    exec: function() { const context = getContext(); if (!isExecAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'child_process.promises.exec()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(p.exec, p, arguments); },
    execFile: function() { const context = getContext(); if (!isExecAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'child_process.promises.execFile()' is not allowed in " + (getContext().id || "unknown"))); return primordials.ReflectApply(p.execFile, p, arguments); },
  });
}

export default Object.freeze(hostChildProcessModule);
`;
}

export function createChildProcessShimCodeCjs() {
	return `${explanation}\n\n${makeRuntimeCommon()}`;
}

export function createChildProcessShimCodeEsm() {
	return `${explanation}\n\n${makeRuntimeCommonEsm()}`;
}
