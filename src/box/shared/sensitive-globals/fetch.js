import { STRATEGIES } from "../../../policy.js";
import { kAllGlobals, kPrimordials } from "../names.js";
import { handleViolation } from "../violation.js";

export function generateFetchGlobal({ id, name, permissions, strategy }) {
	// If coarse 'network' permission is granted, allow all fetch
	if (permissions.network) {
		return `return ${name.for(kAllGlobals)}.fetch`;
	}

	// Check if any sub-capability is enabled
	const networkSubcaps = permissions.networkSubcaps || {
		https: false,
		http: false,
		ip: false,
		dns: false,
		udp: false,
	};

	const hasAnySub =
		networkSubcaps.https ||
		networkSubcaps.http ||
		networkSubcaps.ip;

	if (!hasAnySub) {
		// No network access at all
		const trap = handleViolation({ name, strategy, what: "fetch", who: id });
		const target = strategy === STRATEGIES.log ? `${name.for(kAllGlobals)}.fetch` : "function fetch(){}";
		return `
return ${name.for(kPrimordials)}.NewProxy(
	${target},
	${name.for(kPrimordials)}.ObjectFreeze(
		${name.for(kPrimordials)}.ObjectAssign(
			${name.for(kPrimordials)}.ObjectCreate(null),
			{
				apply(target, thisArg, argumentsList) {
					${trap}
					${strategy === STRATEGIES.log ? `return ${name.for(kPrimordials)}.ReflectApply(target, thisArg, argumentsList);` : ""}
				},
			},
		),
	),
);
		`;
	}

	// Protocol-aware wrapper: inspect URL and enforce sub-capabilities
	// These are embedded directly in the template as boolean literals
	return `
return function fetch(resource, init) {
	let protocol = null;
	let hostname = null;

	// Try to extract protocol and hostname from resource
	try {
		if (typeof resource === 'string' || (resource && typeof resource === 'object' && resource.url !== undefined)) {
			const url = new URL(typeof resource === 'string' ? resource : resource.url);
			protocol = url.protocol;
			hostname = url.hostname;
		}
	} catch (e) {
		// If URL parsing fails, default deny for safety
		${handleViolation({ name, strategy, what: "fetch (unparsable URL)", who: id })}
		${strategy === STRATEGIES.log ? "" : "return;"}
	}

	// Check if the protocol/hostname is allowed by sub-capabilities
	let allowed = false;
	const allowHttps = ${networkSubcaps.https ? "true" : "false"};
	const allowHttp = ${networkSubcaps.http ? "true" : "false"};
	const allowIp = ${networkSubcaps.ip ? "true" : "false"};

	if (protocol === 'https:') {
		allowed = allowHttps;
	} else if (protocol === 'http:') {
		allowed = allowHttp;
	} else if (hostname && /^(?:\\d{1,3}\\.){3}\\d{1,3}$|^\\[/.test(hostname)) {
		// IP address (IPv4 or IPv6 bracket notation)
		allowed = allowIp;
	} else if (!protocol && !hostname) {
		// Relative URL or Request object without parsable URL: use fallback to https
		allowed = allowHttps;
	}

	if (!allowed) {
		${handleViolation({ name, strategy, what: "fetch", who: id })}
		${strategy === STRATEGIES.log ? "" : "return;"}
	}

	// Allowed: forward to real fetch
	return ${name.for(kPrimordials)}.ReflectApply(${name.for(kAllGlobals)}.fetch, globalThis, [resource, init]);
};
	`;
}
