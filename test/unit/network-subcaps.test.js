import test from "node:test";
import assert from "node:assert/strict";
import * as capabilities from "../../src/capabilities.js";

test("network sub-capabilities - capability names exist", () => {
  // Verify that the new sub-capability names are defined
  assert.ok(capabilities.Names.NETWORK_HTTPS, "NETWORK_HTTPS should be defined");
  assert.ok(capabilities.Names.NETWORK_HTTP, "NETWORK_HTTP should be defined");
  assert.ok(capabilities.Names.NETWORK_IP, "NETWORK_IP should be defined");
  assert.ok(capabilities.Names.NETWORK_DNS, "NETWORK_DNS should be defined");
  assert.ok(capabilities.Names.NETWORK_UDP, "NETWORK_UDP should be defined");
});

test("network sub-capabilities - capabilities map has https mappings", () => {
  // Verify that the capabilities map has entries for https
  assert.ok(capabilities.Map[capabilities.Names.NETWORK_HTTPS], 
    "NETWORK_HTTPS should have module mappings");
  
  const httpsModules = capabilities.Map[capabilities.Names.NETWORK_HTTPS];
  assert.ok(httpsModules.includes("https") || httpsModules.includes("node:https"),
    "https modules should be mapped to NETWORK_HTTPS");
});

test("network sub-capabilities - capabilities map has http mappings", () => {
  // Verify that the capabilities map has entries for http
  assert.ok(capabilities.Map[capabilities.Names.NETWORK_HTTP],
    "NETWORK_HTTP should have module mappings");
  
  const httpModules = capabilities.Map[capabilities.Names.NETWORK_HTTP];
  assert.ok(httpModules.includes("http") || httpModules.includes("node:http"),
    "http modules should be mapped to NETWORK_HTTP");
});

test("network sub-capabilities - backwards compatibility coarse NETWORK", () => {
  // Verify that the coarse NETWORK capability is still defined
  assert.ok(capabilities.Names.NETWORK, "NETWORK capability should still exist");
  
  // Check that NETWORK is in the capabilities map
  assert.ok(capabilities.Map[capabilities.Names.NETWORK],
    "NETWORK should have mappings in the capabilities map");
  
  // Verify it includes network-related modules
  const networkModules = capabilities.Map[capabilities.Names.NETWORK];
  assert.ok(networkModules.length > 0, "NETWORK should map to multiple modules");
});
