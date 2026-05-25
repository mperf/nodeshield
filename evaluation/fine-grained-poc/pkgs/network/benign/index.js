import https from 'node:https';

export default function loadConfig() {
    // Benign Network Operation:
    // Perform an HTTPS fetch to retrieve remote metadata.
    https.get('https://example.com', (res) => {
        res.on('data', () => {});
        res.on('end', () => {});
    }).on('error', () => {});

    return 'Performed HTTPS fetch to example.com';
}
