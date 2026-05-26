export const Names = Object.freeze({
	ADDON: "addon",
	CRYPTOGRAPHY: "crypto",
	CRYPTO_RANDOM: "crypto-random",
	CRYPTO_HASH: "crypto-hash",
	CRYPTO_KEY: "crypto-key",
	CRYPTO_CRYPTOOPS: "crypto-cryptoops",
	FILE_SYSTEM: "file-system",
	EXECUTE_COMMAND: "command",
	EXECUTE_CODE: "code",
	// Legacy coarse capability for backwards compatibility
	NETWORK: "network",
	// Fine-grained network sub-capabilities
	NETWORK_HTTPS: "network-https",
	NETWORK_HTTP: "network-http",
	NETWORK_IP: "network-ip",
	NETWORK_DNS: "network-dns",
	NETWORK_UDP: "network-udp",
	// Fine-grained filesystem sub-capabilities
	FS_READ: "fs-read",
	FS_WRITE: "fs-write",
	FS_META: "fs-meta",
	// Fine-grained command/process execution sub-capabilities
	CMD_EXEC: "cmd-exec",
	CMD_WORKER: "cmd-worker",
	SYSTEM: "system",
});

export const Map = Object.freeze({
	[Names.CRYPTOGRAPHY]: ["crypto", "node:crypto"],
	[Names.FILE_SYSTEM]: ["fs", "node:fs", "fs/promises", "node:fs/promises"],
	[Names.EXECUTE_CODE]: ["vm", "node:vm"],
	// Sub-capability mappings for finer-grained enforcement
	[Names.NETWORK_HTTPS]: ["https", "node:https", "node:http2", "http2"],
	[Names.NETWORK_HTTP]: ["http", "node:http"],
	[Names.NETWORK_IP]: ["net", "node:net", "tls", "node:tls"],
	[Names.NETWORK_DNS]: ["dns", "node:dns", "dns/promises", "node:dns/promises"],
	[Names.NETWORK_UDP]: ["dgram", "node:dgram"],
	// Command/process execution sub-capability mappings
	[Names.CMD_EXEC]: ["child_process", "node:child_process"],
	[Names.CMD_WORKER]: ["worker_threads", "node:worker_threads"],
	[Names.SYSTEM]: ["os", "node:os", "process", "node:process"],
});
