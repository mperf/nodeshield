#!/usr/bin/env node

/**
 * CBOM Converter - Converts legacy coarse "network" capabilities
 * to fine-grained network sub-capabilities.
 * 
 * Usage:
 *   node convert-cbom.js <input.json> <output.json>
 *   node convert-cbom.js <input.json> [--in-place]
 */

import * as fs from "node:fs";
import * as path from "node:path";

const COARSE_NETWORK = "network";
const FINE_GRAINED_NETWORK = [
  "network-https",
  "network-http",
  "network-ip",
  "network-dns",
  "network-udp",
];

/**
 * Convert a CBOM component's capabilities from coarse to fine-grained
 * @param {Object} component - A CycloneDX component object
 * @returns {Object} - The modified component
 */
function convertComponentCapabilities(component) {
  if (!component.properties || !Array.isArray(component.properties)) {
    return component;
  }

  const capProp = component.properties.find((p) => p.name === "nodeshield:capabilities");
  if (!capProp || !capProp.value) {
    return component;
  }

  let capabilities = [];
  try {
    capabilities = JSON.parse(capProp.value);
  } catch (e) {
    console.warn(`Warning: Could not parse capabilities for ${component.name}: ${e.message}`);
    return component;
  }

  if (!Array.isArray(capabilities)) {
    return component;
  }

  // Check if this component has the coarse "network" capability
  const hasCoarseNetwork = capabilities.includes(COARSE_NETWORK);

  if (hasCoarseNetwork) {
    // Remove coarse network and add fine-grained ones
    const filtered = capabilities.filter((c) => c !== COARSE_NETWORK);
    const newCapabilities = [...filtered, ...FINE_GRAINED_NETWORK];

    // Update the capability property with unique values
    const uniqueCapabilities = [...new Set(newCapabilities)].sort();
    capProp.value = JSON.stringify(uniqueCapabilities);

    console.log(
      `  ✓ ${component.name} v${component.version}: "network" → [${FINE_GRAINED_NETWORK.join(", ")}]`
    );
  }

  return component;
}

/**
 * Convert all components in a CBOM
 * @param {Object} cbom - The CBOM document
 * @returns {Object} - The modified CBOM
 */
function convertCbom(cbom) {
  if (cbom.components && Array.isArray(cbom.components)) {
    cbom.components = cbom.components.map(convertComponentCapabilities);
  }

  return cbom;
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
CBOM Fine-Grained Network Permissions Converter

Converts legacy coarse "network" capabilities to fine-grained sub-capabilities:
- network-https
- network-http
- network-ip
- network-dns
- network-udp

Usage:
  node convert-cbom.js <input.json> <output.json>
  node convert-cbom.js <input.json> --in-place

Arguments:
  <input.json>      Path to input CBOM file
  <output.json>     Path to write converted CBOM (optional)
  --in-place        Modify input file in place

Examples:
  # Convert and save to new file
  node convert-cbom.js cbom.json cbom-converted.json

  # Convert in place
  node convert-cbom.js cbom.json --in-place

  # Print to stdout
  node convert-cbom.js cbom.json /dev/stdout
    `);
    process.exit(0);
  }

  const inputFile = args[0];
  let outputFile = args[1];

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file not found: ${inputFile}`);
    process.exit(1);
  }

  try {
    console.log(`\nReading CBOM from: ${inputFile}`);
    const content = fs.readFileSync(inputFile, "utf-8");
    const cbom = JSON.parse(content);

    console.log(`Converting capabilities...\n`);
    const converted = convertCbom(cbom);

    // Determine output file
    if (outputFile === "--in-place") {
      outputFile = inputFile;
    } else if (!outputFile) {
      // Default to stdout
      outputFile = "/dev/stdout";
    }

    const output = JSON.stringify(converted, null, 2);

    fs.writeFileSync(outputFile, output, "utf-8");
    console.log(`\n✓ Converted CBOM written to: ${outputFile}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
