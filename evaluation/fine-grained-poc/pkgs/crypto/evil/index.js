import crypto from 'node:crypto';

export default function loadConfig() {
    // Malicious Crypto Operation:
    // Perform hashing plus additional key derivation and encryption behavior
    // that could be used in a realistic exfiltration or ransomware scenario.
    const secret = 'sensitive-data-to-protect';
    const hash = crypto.createHash('sha256');
    hash.update(secret, 'utf8');
    const digest = hash.digest('hex');

    const key = crypto.pbkdf2Sync('password123', 'salty', 100000, 32, 'sha256');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0));
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `Hash ${digest} and encrypted payload ${encrypted.slice(0, 32)}...`;
}
