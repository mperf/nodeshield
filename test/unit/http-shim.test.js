import test from "node:test";
import assert from "node:assert/strict";

import {
	classifyHttpTarget,
	isAllowedHttpTarget,
} from "../../src/box/internals/http.js";

test("http shim - classify absolute https URL", () => {
	const target = classifyHttpTarget("https://example.com/path", "http:");

	assert.equal(target.protocol, "https:");
	assert.equal(target.hostname, "example.com");
	assert.equal(target.description, "https://example.com/path");
});

test("http shim - allow http targets with http permission", () => {
	const target = classifyHttpTarget({ hostname: "example.com" }, "http:");

	assert.equal(
		isAllowedHttpTarget(
			target,
			{
				network: false,
				networkSubcaps: { http: true, https: false, ip: false },
			},
			"http:",
		),
		true,
	);
});

test("http shim - deny https targets when only http is granted", () => {
	const target = classifyHttpTarget("https://example.com", "http:");

	assert.equal(
		isAllowedHttpTarget(
			target,
			{
				network: false,
				networkSubcaps: { http: true, https: false, ip: false },
			},
			"http:",
		),
		false,
	);
});

test("http shim - allow ip targets only with ip permission", () => {
	const target = classifyHttpTarget("http://127.0.0.1:8080", "http:");

	assert.equal(
		isAllowedHttpTarget(
			target,
			{
				network: false,
				networkSubcaps: { http: false, https: false, ip: true },
			},
			"http:",
		),
		true,
	);
});