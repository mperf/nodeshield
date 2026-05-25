const explanation = `
/// Shim for 'node:fs'. Wraps filesystem methods so each call
/// can be checked against the active box permissions.
`;

function makeRuntimeCommon() {
  return `
const globals = require("./globals.cjs");
const hostModule = require("node:fs");

const primordials = globals.primordials;

function isReadAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const fsSubcaps = (permissions || {}).fsSubcaps || { read: false };
  return !!fsSubcaps.read;
}

function isWriteAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const fsSubcaps = (permissions || {}).fsSubcaps || { write: false };
  return !!fsSubcaps.write;
}

function isMetaAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const fsSubcaps = (permissions || {}).fsSubcaps || { meta: false };
  return !!fsSubcaps.meta;
}

function parseFlags(flags) {
  if (!flags) return "read";
  const f = typeof flags === "string" ? flags : flags.toString();
  if (f.includes("w") || f.includes("a")) return "write";
  return "read";
}

// THIS IS THE NEW FACTORY EXPORT FOR CJS
module.exports.createFsShim = function(context) {

  // reportViolation now uses the baked-in 'context' from the closure
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

  function wrapReadMethod(fnName) {
    const fn = hostModule[fnName];
    if (typeof fn !== "function") return fn;
    return function wrapped(...args) {
      if (!isReadAllowed(context.permissions || {})) {
        return reportViolation("fs." + fnName + "()");
      }
      return primordials.ReflectApply(fn, hostModule, args);
    };
  }

  function wrapWriteMethod(fnName) {
    const fn = hostModule[fnName];
    if (typeof fn !== "function") return fn;
    return function wrapped(...args) {
      if (!isWriteAllowed(context.permissions || {})) {
        return reportViolation("fs." + fnName + "()");
      }
      return primordials.ReflectApply(fn, hostModule, args);
    };
  }

  function wrapMetaMethod(fnName) {
    const fn = hostModule[fnName];
    if (typeof fn !== "function") return fn;
    return function wrapped(...args) {
      if (!isMetaAllowed(context.permissions || {})) {
        return reportViolation("fs." + fnName + "()");
      }
      return primordials.ReflectApply(fn, hostModule, args);
    };
  }

  function wrapOpen() {
    const fn = hostModule.open;
    if (typeof fn !== "function") return fn;
    return function wrapped(path, flags, mode, callback) {
      const flagType = parseFlags(flags);
      const allowed = flagType === "write" ? isWriteAllowed(context.permissions || {}) : isReadAllowed(context.permissions || {});
      if (!allowed) {
        return reportViolation("fs.open(" + path + ", " + String(flags) + ")");
      }
      return primordials.ReflectApply(fn, hostModule, arguments);
    };
  }

  function wrapOpenSync() {
    const fn = hostModule.openSync;
    if (typeof fn !== "function") return fn;
    return function wrapped(path, flags, mode) {
      const flagType = parseFlags(flags);
      const allowed = flagType === "write" ? isWriteAllowed(context.permissions || {}) : isReadAllowed(context.permissions || {});
      if (!allowed) {
        return reportViolation("fs.openSync(" + path + ", " + String(flags) + ")");
      }
      return primordials.ReflectApply(fn, hostModule, [path, flags, mode]);
    };
  }

  const hostFsModule = Object.assign(Object.create(null), Object.getOwnPropertyNames(hostModule).reduce((acc, k) => {
    acc[k] = hostModule[k];
    return acc;
  }, {}));

  // Wrap read methods
  hostFsModule.readFile = wrapReadMethod("readFile");
  hostFsModule.readFileSync = wrapReadMethod("readFileSync");
  hostFsModule.readdir = wrapReadMethod("readdir");
  hostFsModule.readdirSync = wrapReadMethod("readdirSync");
  hostFsModule.stat = wrapReadMethod("stat");
  hostFsModule.statSync = wrapReadMethod("statSync");
  hostFsModule.lstat = wrapReadMethod("lstat");
  hostFsModule.lstatSync = wrapReadMethod("lstatSync");
  hostFsModule.createReadStream = wrapReadMethod("createReadStream");
  hostFsModule.access = wrapReadMethod("access");
  hostFsModule.accessSync = wrapReadMethod("accessSync");

  // Wrap write methods
  hostFsModule.writeFile = wrapWriteMethod("writeFile");
  hostFsModule.writeFileSync = wrapWriteMethod("writeFileSync");
  hostFsModule.appendFile = wrapWriteMethod("appendFile");
  hostFsModule.appendFileSync = wrapWriteMethod("appendFileSync");
  hostFsModule.createWriteStream = wrapWriteMethod("createWriteStream");
  hostFsModule.mkdir = wrapWriteMethod("mkdir");
  hostFsModule.mkdirSync = wrapWriteMethod("mkdirSync");
  hostFsModule.rm = wrapWriteMethod("rm");
  hostFsModule.rmSync = wrapWriteMethod("rmSync");
  hostFsModule.rename = wrapWriteMethod("rename");
  hostFsModule.renameSync = wrapWriteMethod("renameSync");
  hostFsModule.copyFile = wrapWriteMethod("copyFile");
  hostFsModule.copyFileSync = wrapWriteMethod("copyFileSync");

  // Wrap meta methods
  hostFsModule.chmod = wrapMetaMethod("chmod");
  hostFsModule.chmodSync = wrapMetaMethod("chmodSync");
  hostFsModule.chown = wrapMetaMethod("chown");
  hostFsModule.chownSync = wrapMetaMethod("chownSync");
  hostFsModule.utimes = wrapMetaMethod("utimes");
  hostFsModule.utimesSync = wrapMetaMethod("utimesSync");

  // Wrap open (checks flags at runtime)
  hostFsModule.open = wrapOpen();
  hostFsModule.openSync = wrapOpenSync();

  // Wrap promises sub-object
  if (hostModule.promises) {
    const p = hostModule.promises;
    hostFsModule.promises = Object.freeze({
      readFile: function() { if (!isReadAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.readFile()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.readFile, p, arguments); },
      writeFile: function() { if (!isWriteAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.writeFile()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.writeFile, p, arguments); },
      appendFile: function() { if (!isWriteAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.appendFile()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.appendFile, p, arguments); },
      readdir: function() { if (!isReadAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.readdir()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.readdir, p, arguments); },
      stat: function() { if (!isReadAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.stat()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.stat, p, arguments); },
      lstat: function() { if (!isReadAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.lstat()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.lstat, p, arguments); },
      mkdir: function() { if (!isWriteAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.mkdir()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.mkdir, p, arguments); },
      rm: function() { if (!isWriteAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.rm()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.rm, p, arguments); },
      rename: function() { if (!isWriteAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.rename()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.rename, p, arguments); },
      copyFile: function() { if (!isWriteAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.copyFile()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.copyFile, p, arguments); },
      chmod: function() { if (!isMetaAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.chmod()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.chmod, p, arguments); },
      chown: function() { if (!isMetaAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.chown()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.chown, p, arguments); },
      utimes: function() { if (!isMetaAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.utimes()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.utimes, p, arguments); },
    });
  }

  return Object.freeze(hostFsModule);
};
`;
}

function makeRuntimeCommonEsm() {
  return `
import globals from "./globals.cjs";
import * as hostModule from "node:fs";

const primordials = globals.primordials;

function isReadAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const fsSubcaps = (permissions || {}).fsSubcaps || { read: false };
  return !!fsSubcaps.read;
}

function isWriteAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const fsSubcaps = (permissions || {}).fsSubcaps || { write: false };
  return !!fsSubcaps.write;
}

function isMetaAllowed(permissions) {
  if ((permissions || {}).network) return true;
  const fsSubcaps = (permissions || {}).fsSubcaps || { meta: false };
  return !!fsSubcaps.meta;
}

function parseFlags(flags) {
  if (!flags) return "read";
  const f = typeof flags === "string" ? flags : flags.toString();
  if (f.includes("w") || f.includes("a")) return "write";
  return "read";
}

// THIS IS THE NEW FACTORY EXPORT
export function createFsShim(context) {

  // reportViolation now uses the baked-in 'context' from the closure
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

  function wrapReadMethod(target, fnName) {
    const fn = target[fnName];
    if (typeof fn !== "function") return fn;
    return function wrapped(...args) {
      if (!isReadAllowed(context.permissions || {})) {
        return reportViolation("fs." + fnName + "()");
      }
      return primordials.ReflectApply(fn, target, args);
    };
  }

  function wrapWriteMethod(target, fnName) {
    const fn = target[fnName];
    if (typeof fn !== "function") return fn;
    return function wrapped(...args) {
      if (!isWriteAllowed(context.permissions || {})) {
        return reportViolation("fs." + fnName + "()");
      }
      return primordials.ReflectApply(fn, target, args);
    };
  }

  function wrapMetaMethod(target, fnName) {
    const fn = target[fnName];
    if (typeof fn !== "function") return fn;
    return function wrapped(...args) {
      if (!isMetaAllowed(context.permissions || {})) {
        return reportViolation("fs." + fnName + "()");
      }
      return primordials.ReflectApply(fn, target, args);
    };
  }

  function wrapOpen(target) {
    const fn = target.open;
    if (typeof fn !== "function") return fn;
    return function wrapped(path, flags, mode, callback) {
      const flagType = parseFlags(flags);
      const allowed = flagType === "write" ? isWriteAllowed(context.permissions || {}) : isReadAllowed(context.permissions || {});
      if (!allowed) {
        return reportViolation("fs.open(" + path + ", " + String(flags) + ")");
      }
      return primordials.ReflectApply(fn, target, arguments);
    };
  }

  function wrapOpenSync(target) {
    const fn = target.openSync;
    if (typeof fn !== "function") return fn;
    return function wrapped(path, flags, mode) {
      const flagType = parseFlags(flags);
      const allowed = flagType === "write" ? isWriteAllowed(context.permissions || {}) : isReadAllowed(context.permissions || {});
      if (!allowed) {
        return reportViolation("fs.openSync(" + path + ", " + String(flags) + ")");
      }
      return primordials.ReflectApply(fn, target, [path, flags, mode]);
    };
  }

  const hostFsModule = Object.assign(Object.create(null), { ...hostModule });

  hostFsModule.readFile = wrapReadMethod(hostModule, "readFile");
  hostFsModule.readFileSync = wrapReadMethod(hostModule, "readFileSync");
  hostFsModule.readdir = wrapReadMethod(hostModule, "readdir");
  hostFsModule.readdirSync = wrapReadMethod(hostModule, "readdirSync");
  hostFsModule.stat = wrapReadMethod(hostModule, "stat");
  hostFsModule.statSync = wrapReadMethod(hostModule, "statSync");
  hostFsModule.lstat = wrapReadMethod(hostModule, "lstat");
  hostFsModule.lstatSync = wrapReadMethod(hostModule, "lstatSync");
  hostFsModule.createReadStream = wrapReadMethod(hostModule, "createReadStream");
  hostFsModule.access = wrapReadMethod(hostModule, "access");
  hostFsModule.accessSync = wrapReadMethod(hostModule, "accessSync");

  hostFsModule.writeFile = wrapWriteMethod(hostModule, "writeFile");
  hostFsModule.writeFileSync = wrapWriteMethod(hostModule, "writeFileSync");
  hostFsModule.appendFile = wrapWriteMethod(hostModule, "appendFile");
  hostFsModule.appendFileSync = wrapWriteMethod(hostModule, "appendFileSync");
  hostFsModule.createWriteStream = wrapWriteMethod(hostModule, "createWriteStream");
  hostFsModule.mkdir = wrapWriteMethod(hostModule, "mkdir");
  hostFsModule.mkdirSync = wrapWriteMethod(hostModule, "mkdirSync");
  hostFsModule.rm = wrapWriteMethod(hostModule, "rm");
  hostFsModule.rmSync = wrapWriteMethod(hostModule, "rmSync");
  hostFsModule.rename = wrapWriteMethod(hostModule, "rename");
  hostFsModule.renameSync = wrapWriteMethod(hostModule, "renameSync");
  hostFsModule.copyFile = wrapWriteMethod(hostModule, "copyFile");
  hostFsModule.copyFileSync = wrapWriteMethod(hostModule, "copyFileSync");

  hostFsModule.chmod = wrapMetaMethod(hostModule, "chmod");
  hostFsModule.chmodSync = wrapMetaMethod(hostModule, "chmodSync");
  hostFsModule.chown = wrapMetaMethod(hostModule, "chown");
  hostFsModule.chownSync = wrapMetaMethod(hostModule, "chownSync");
  hostFsModule.utimes = wrapMetaMethod(hostModule, "utimes");
  hostFsModule.utimesSync = wrapMetaMethod(hostModule, "utimesSync");

  hostFsModule.open = wrapOpen(hostModule);
  hostFsModule.openSync = wrapOpenSync(hostModule);

  if (hostModule.promises) {
    const p = hostModule.promises;
    hostFsModule.promises = Object.freeze({
      readFile: function() { if (!isReadAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.readFile()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.readFile, p, arguments); },
      writeFile: function() { if (!isWriteAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.writeFile()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.writeFile, p, arguments); },
      appendFile: function() { if (!isWriteAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.appendFile()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.appendFile, p, arguments); },
      readdir: function() { if (!isReadAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.readdir()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.readdir, p, arguments); },
      stat: function() { if (!isReadAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.stat()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.stat, p, arguments); },
      lstat: function() { if (!isReadAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.lstat()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.lstat, p, arguments); },
      mkdir: function() { if (!isWriteAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.mkdir()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.mkdir, p, arguments); },
      rm: function() { if (!isWriteAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.rm()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.rm, p, arguments); },
      rename: function() { if (!isWriteAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.rename()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.rename, p, arguments); },
      copyFile: function() { if (!isWriteAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.copyFile()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.copyFile, p, arguments); },
      chmod: function() { if (!isMetaAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.chmod()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.chmod, p, arguments); },
      chown: function() { if (!isMetaAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.chown()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.chown, p, arguments); },
      utimes: function() { if (!isMetaAllowed(context.permissions || {})) return Promise.reject(primordials.NewError("using 'fs.promises.utimes()' is not allowed in " + (context.id || "unknown"))); return primordials.ReflectApply(p.utimes, p, arguments); },
    });
  }

  // Bind the default export so ESM default imports (import fs from 'fs') work properly
  hostFsModule.default = hostFsModule;
  return Object.freeze(hostFsModule);
}
`;
}

export function createFsShimCodeCjs() {
	return `${explanation}\n\n${makeRuntimeCommon()}`;
}

export function createFsShimCodeEsm() {
	return `${explanation}\n\n${makeRuntimeCommonEsm()}`;
}
