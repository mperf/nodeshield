import crypto from 'node:crypto';

export default function loadConfig() {
    // Benign Crypto Operation:
    // Compute a common SHA-256 hash of some configuration data.
    const data = 'user@example.com:default-settings';
    const hash = crypto.createHash('sha256');
    hash.update(data, 'utf8');

    return `Computed SHA-256 digest: ${hash.digest('hex')}`;
}
