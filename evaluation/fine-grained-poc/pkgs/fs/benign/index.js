import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export default function loadConfig() {
    // Realistic Benign Operation: 
    // Reading a user's environment configuration file to parse aliases or paths.
    const bashrcPath = path.join(os.homedir(), '.bashrc');
    
    try {
        // This requires the FS_READ capability
        const configData = fs.readFileSync(bashrcPath, 'utf8');
        
        // Simulating the package doing some benign parsing...
        return `Successfully read ${configData.split('\n').length} lines from .bashrc`;
    } catch (error) {
        return "Config file not found, falling back to defaults.";
    }
}