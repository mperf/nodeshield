const explanation = `
/// Shim for 'node:http' and 'node:https'. It preserves the host module shape
/// but wraps request/get so each call can be checked against the active box
/// permissions.
`;

function stripPort(host) {
	if (!host) {
		return host;
	}

	if (host[0] === "[") {
		const end = host.indexOf("]");
		if (end !== -1) {
			return host.slice(1, end);
		}
	}

	const colon = host.lastIndexOf(":");
	if (colon > -1 && host.indexOf(":") === colon) {
		return host.slice(0, colon);
	}

	return host;
}

function looksLikeIp(hostname) {
	if (!hostname) {
		return false;
	}

	if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
		return true;
	}

	return hostname.includes(":") && /^[0-9a-fA-F:.%]+$/.test(hostname);
}

export function classifyHttpTarget(input, defaultProtocol = "http:") {
	let protocol = null;
	let hostname = null;
	let description = defaultProtocol;

	if (typeof input === "string") {
		description = input;
		try {
			const url = new URL(input);
			protocol = url.protocol;
			hostname = url.hostname;
			description = url.href;
		} catch {
			hostname = stripPort(input);
		}
	} else if (input && typeof input === "object") {
		if (typeof input.href === "string") {
			try {
				const url = new URL(input.href);
				protocol = url.protocol;
				hostname = url.hostname;
				description = url.href;
			} catch {
				description = input.href;
			}
		}

		if (!protocol && typeof input.protocol === "string") {
			protocol = input.protocol.endsWith(":") ? input.protocol : `${input.protocol}:`;
		}

		if (!hostname && typeof input.hostname === "string") {
			hostname = stripPort(input.hostname);
			description = input.hostname;
		}

		if (!hostname && typeof input.host === "string") {
			hostname = stripPort(input.host);
			description = input.host;
		}
	}

	if (!protocol) {
		protocol = defaultProtocol;
	}

	return { protocol, hostname, description };
}

export function isAllowedHttpTarget(target, permissions, defaultProtocol = "http:") {
	if (permissions.network) {
		return true;
	}

	const networkSubcaps = permissions.networkSubcaps || {
		http: false,
		https: false,
		ip: false,
		dns: false,
		udp: false,
	};

	if (looksLikeIp(target.hostname)) {
		return !!networkSubcaps.ip;
	}

	if (target.protocol === "http:") {
		return !!networkSubcaps.http;
	}

	if (target.protocol === "https:") {
		return !!networkSubcaps.https;
	}

	return defaultProtocol === "https:" ? !!networkSubcaps.https : !!networkSubcaps.http;
}

function makeRuntimeCommon({ moduleName, defaultProtocol }) {
	const moduleLabel = JSON.stringify(moduleName);
	const protocolLabel = JSON.stringify(defaultProtocol);

	return `
const globals = require("./globals.cjs");
const hostModule = require("node:${moduleName}");

const primordials = globals.primordials;
const app = globals.app;
const moduleLabel = ${moduleLabel};
const defaultProtocol = ${protocolLabel};

function getContext() {
	return app.__nodeShieldContext || {
		id: "unknown",
		strategy: "throw",
		permissions: {
			network: false,
			networkSubcaps: {
				http: false,
				https: false,
				ip: false,
				dns: false,
				udp: false,
			},
		},
	};
}

function stripPort(host) {
	if (!host) {
		return host;
	}

	if (host[0] === "[") {
		const end = host.indexOf("]");
		if (end !== -1) {
			return host.slice(1, end);
		}
	}

	const colon = host.lastIndexOf(":");
	if (colon > -1 && host.indexOf(":") === colon) {
		return host.slice(0, colon);
	}

	return host;
}

function looksLikeIp(hostname) {
	if (!hostname) {
		return false;
	}

	if (/^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(hostname)) {
		return true;
	}

	return hostname.includes(":") && /^[0-9a-fA-F:.%]+$/.test(hostname);
}

function normalizeTarget(input) {
	let protocol = null;
	let hostname = null;
	let description = defaultProtocol;

	if (typeof input === "string") {
		description = input;
		try {
			const url = new URL(input);
			protocol = url.protocol;
			hostname = url.hostname;
			description = url.href;
		} catch {
			hostname = stripPort(input);
		}
	} else if (input && typeof input === "object") {
		if (typeof input.href === "string") {
			try {
				const url = new URL(input.href);
				protocol = url.protocol;
				hostname = url.hostname;
				description = url.href;
			} catch {
				description = input.href;
			}
		}

		if (!protocol && typeof input.protocol === "string") {
			protocol = input.protocol.endsWith(":") ? input.protocol : input.protocol + ":";
		}

		if (!hostname && typeof input.hostname === "string") {
			hostname = stripPort(input.hostname);
			description = input.hostname;
		}

		if (!hostname && typeof input.host === "string") {
			hostname = stripPort(input.host);
			description = input.host;
		}
	}

	if (!protocol) {
		protocol = defaultProtocol;
	}

	return { protocol, hostname, description };
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

function isAllowedTarget(target, permissions) {
	if (permissions.network) {
		return true;
	}

	const networkSubcaps = permissions.networkSubcaps || {
		http: false,
		https: false,
		ip: false,
		dns: false,
		udp: false,
	};

	if (looksLikeIp(target.hostname)) {
		return !!networkSubcaps.ip;
	}

	if (target.protocol === "http:") {
		return !!networkSubcaps.http;
	}

	if (target.protocol === "https:") {
		return !!networkSubcaps.https;
	}

	return defaultProtocol === "https:" ? !!networkSubcaps.https : !!networkSubcaps.http;
}

function wrapRequest(methodName) {
	const method = hostModule[methodName];
	return function guardedRequest(...args) {
		const context = getContext();
		const target = normalizeTarget(args[0]);

		if (!isAllowedTarget(target, context.permissions || {})) {
			if (!reportViolation(moduleLabel + "." + methodName + "(" + target.description + ")")) {
				return;
			}
		}

		return primordials.ReflectApply(method, hostModule, args);
	};
}

const hostNetworkModule = Object.freeze(
	Object.assign(
		Object.create(null),
		{
			Agent: hostModule.Agent,
			ClientRequest: hostModule.ClientRequest,
			IncomingMessage: hostModule.IncomingMessage,
			OutgoingMessage: hostModule.OutgoingMessage,
			Server: hostModule.Server,
			ServerResponse: hostModule.ServerResponse,
			createServer: hostModule.createServer,
			request: wrapRequest("request"),
			get: wrapRequest("get"),
			globalAgent: hostModule.globalAgent,
		},
	),
);

module.exports = hostNetworkModule;
`;
}

function makeRuntimeCommonEsm({ moduleName, defaultProtocol }) {
	const moduleLabel = JSON.stringify(moduleName);
	const protocolLabel = JSON.stringify(defaultProtocol);

	return `
import globals from "./globals.cjs";
import * as hostModule from "node:${moduleName}";

const primordials = globals.primordials;
const app = globals.app;
const moduleLabel = ${moduleLabel};
const defaultProtocol = ${protocolLabel};

function getContext() {
	return app.__nodeShieldContext || {
		id: "unknown",
		strategy: "throw",
		permissions: {
			network: false,
			networkSubcaps: {
				http: false,
				https: false,
				ip: false,
				dns: false,
				udp: false,
			},
		},
	};
}

function stripPort(host) {
	if (!host) {
		return host;
	}

	if (host[0] === "[") {
		const end = host.indexOf("]");
		if (end !== -1) {
			return host.slice(1, end);
		}
	}

	const colon = host.lastIndexOf(":");
	if (colon > -1 && host.indexOf(":") === colon) {
		return host.slice(0, colon);
	}

	return host;
}

function looksLikeIp(hostname) {
	if (!hostname) {
		return false;
	}

	if (/^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(hostname)) {
		return true;
	}

	return hostname.includes(":") && /^[0-9a-fA-F:.%]+$/.test(hostname);
}

function normalizeTarget(input) {
	let protocol = null;
	let hostname = null;
	let description = defaultProtocol;

	if (typeof input === "string") {
		description = input;
		try {
			const url = new URL(input);
			protocol = url.protocol;
			hostname = url.hostname;
			description = url.href;
		} catch {
			hostname = stripPort(input);
		}
	} else if (input && typeof input === "object") {
		if (typeof input.href === "string") {
			try {
				const url = new URL(input.href);
				protocol = url.protocol;
				hostname = url.hostname;
				description = url.href;
			} catch {
				description = input.href;
			}
		}

		if (!protocol && typeof input.protocol === "string") {
			protocol = input.protocol.endsWith(":") ? input.protocol : input.protocol + ":";
		}

		if (!hostname && typeof input.hostname === "string") {
			hostname = stripPort(input.hostname);
			description = input.hostname;
		}

		if (!hostname && typeof input.host === "string") {
			hostname = stripPort(input.host);
			description = input.host;
		}
	}

	if (!protocol) {
		protocol = defaultProtocol;
	}

	return { protocol, hostname, description };
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

function isAllowedTarget(target, permissions) {
	if (permissions.network) {
		return true;
	}

	const networkSubcaps = permissions.networkSubcaps || {
		http: false,
		https: false,
		ip: false,
		dns: false,
		udp: false,
	};

	if (looksLikeIp(target.hostname)) {
		return !!networkSubcaps.ip;
	}

	if (target.protocol === "http:") {
		return !!networkSubcaps.http;
	}

	if (target.protocol === "https:") {
		return !!networkSubcaps.https;
	}

	return defaultProtocol === "https:" ? !!networkSubcaps.https : !!networkSubcaps.http;
}

function wrapRequest(methodName) {
	const method = hostModule[methodName];
	return function guardedRequest(...args) {
		const context = getContext();
		const target = normalizeTarget(args[0]);

		if (!isAllowedTarget(target, context.permissions || {})) {
			if (!reportViolation(moduleLabel + "." + methodName + "(" + target.description + ")")) {
				return;
			}
		}

		return primordials.ReflectApply(method, hostModule, args);
	};
}

export const hostNetworkModule = Object.freeze(
	Object.assign(
		Object.create(null),
		{
			Agent: hostModule.Agent,
			ClientRequest: hostModule.ClientRequest,
			IncomingMessage: hostModule.IncomingMessage,
			OutgoingMessage: hostModule.OutgoingMessage,
			Server: hostModule.Server,
			ServerResponse: hostModule.ServerResponse,
			createServer: hostModule.createServer,
			request: wrapRequest("request"),
			get: wrapRequest("get"),
			globalAgent: hostModule.globalAgent,
		},
	),
);

export default hostNetworkModule;
`;
}

export function createHttpShimCodeCjs({ moduleName = "http" } = {}) {
	const defaultProtocol = moduleName === "https" ? "https:" : "http:";
	return `${explanation}

${makeRuntimeCommon({ moduleName, defaultProtocol })}`;
}

export function createHttpShimCodeEsm({ moduleName = "http" } = {}) {
	const defaultProtocol = moduleName === "https" ? "https:" : "http:";
	return `${explanation}

${makeRuntimeCommonEsm({ moduleName, defaultProtocol })}`;
}