import loadConfig from "poc-pkg";

console.log("[*] Victim App Initializing...");

try {
    const result = loadConfig();
    console.log("[*] Execution Result:", result);
} catch (error) {
    console.error("[!] An error occurred during execution:", error.message);
}