import * as path from "node:path";

import * as capabilities from "../capabilities.js";
import * as random from "./random.js";
import { STRATEGIES } from "../policy.js";

export function noisyName(id) {
	if (!id) {
		throw new Error(
			"id required as it gives better guarantees variable names are unique",
		);
	}

	return id + "$" + random.hex();
}

export function codeGenerationPolicy({ permissions, strategy }) {
	if (permissions.code || strategy === STRATEGIES.log) {
		return "{strings: true, wasm: true}";
	} else {
		return "{strings: false, wasm: false}";
	}
}

export function policyToPermissions(file, policy, out) {
	const context = Object.assign(Object.create(null), {
		command: false,
		code: false,
		crypto: false,
		network: false,
		// Structured fine-grained network permissions
		networkSubcaps: {
			https: false,
			http: false,
			ip: false,
			dns: false,
			udp: false,
		},
		// Structured fine-grained filesystem permissions
		fsSubcaps: {
			read: false,
			write: false,
			meta: false,
		},
		process: false,

		import: Object.assign(Object.create(null), {
			packages: [...policy.node, ...policy.packages],
			files: Array.from(
				new Set([
					...policy.files
						.map((to) => path.join(out, to))
						.flatMap((file) => [
							file,
							file.replace(new RegExp(`${path.extname(file)}$`), ""), // file w/o extension
							path.dirname(file), // directories (which imports index.js)
						]),
				]),
			),
		}),
	});

	if (policy.capabilities.includes(capabilities.Names.CRYPTOGRAPHY)) {
		context.crypto = true;
		context.import.packages.push("crypto", "node:crypto");
	}

	if (policy.capabilities.includes(capabilities.Names.EXECUTE_COMMAND)) {
		context.command = true;
	}

	if (policy.capabilities.includes(capabilities.Names.EXECUTE_CODE)) {
		context.code = true;
		context.import.packages.push("vm", "node:vm");
	}

	// Handle coarse NETWORK capability: grant all sub-capabilities for backwards compatibility
	if (policy.capabilities.includes(capabilities.Names.NETWORK)) {
		context.network = true;
		context.networkSubcaps.https = true;
		context.networkSubcaps.http = true;
		context.networkSubcaps.ip = true;
		context.networkSubcaps.dns = true;
		context.networkSubcaps.udp = true;
		context.import.packages.push(
			"node:dns",
			"dns",
			"node:dns/promises",
			"dns/promises",
			"node:http",
			"http",
			"node:https",
			"https",
			"node:http2",
			"http2",
			"node:net",
			"net",
		);
	}

	// Handle fine-grained network sub-capabilities
	if (policy.capabilities.includes(capabilities.Names.NETWORK_HTTPS)) {
		context.networkSubcaps.https = true;
		context.import.packages.push("node:https", "https", "node:http2", "http2");
	}

	if (policy.capabilities.includes(capabilities.Names.NETWORK_HTTP)) {
		context.networkSubcaps.http = true;
		context.import.packages.push("node:http", "http");
	}

	if (policy.capabilities.includes(capabilities.Names.NETWORK_IP)) {
		context.networkSubcaps.ip = true;
		context.import.packages.push("node:net", "net", "node:tls", "tls");
	}

	if (policy.capabilities.includes(capabilities.Names.NETWORK_DNS)) {
		context.networkSubcaps.dns = true;
		context.import.packages.push(
			"node:dns",
			"dns",
			"node:dns/promises",
			"dns/promises"
		);
	}

	if (policy.capabilities.includes(capabilities.Names.NETWORK_UDP)) {
		context.networkSubcaps.udp = true;
		context.import.packages.push("node:dgram", "dgram");
	}

	// Handle coarse FILE_SYSTEM capability: grant all sub-capabilities for backwards compatibility
	if (policy.capabilities.includes(capabilities.Names.FILE_SYSTEM)) {
		context.fsSubcaps.read = true;
		context.fsSubcaps.write = true;
		context.fsSubcaps.meta = true;
		context.import.packages.push("fs", "node:fs", "fs/promises", "node:fs/promises");
	}

	// Handle fine-grained filesystem sub-capabilities
	if (policy.capabilities.includes(capabilities.Names.FS_READ)) {
		context.fsSubcaps.read = true;
		context.import.packages.push("fs", "node:fs", "fs/promises", "node:fs/promises");
	}

	if (policy.capabilities.includes(capabilities.Names.FS_WRITE)) {
		context.fsSubcaps.write = true;
		context.import.packages.push("fs", "node:fs", "fs/promises", "node:fs/promises");
	}

	if (policy.capabilities.includes(capabilities.Names.FS_META)) {
		context.fsSubcaps.meta = true;
		context.import.packages.push("fs", "node:fs", "fs/promises", "node:fs/promises");
	}

	if (policy.capabilities.includes(capabilities.Names.SYSTEM)) {
		context.process = true;
		context.import.packages.push("node:process", "process");
	}

	return context;
}
