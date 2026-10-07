#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';

const LISTEN_PORTS = [80, 443];
const FIRST_BYTES_TIMEOUT_MS = 5_000;

const [logPath] = process.argv.slice(2);

if (!logPath) {
  console.error('Usage: smoke-host-sink.mjs <log-file>');
  process.exit(1);
}

writeFileSync(logPath, '');

// The HTTP Host header or the TLS SNI both carry the requested hostname in clear text
const extractServerName = (bytes) => {
  const text = bytes.toString('latin1');
  const hostHeader = text.match(/^Host:\s*([^\r\n]+)/im)?.[1];

  if (hostHeader) {
    return hostHeader.trim();
  }

  return (
    text
      .match(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi)
      ?.find((candidate) => /[a-z]/i.test(candidate.split('.').pop())) ?? 'unknown'
  );
};

for (const port of LISTEN_PORTS) {
  net
    .createServer((socket) => {
      let isRecorded = false;

      const record = (serverName) => {
        if (isRecorded) {
          return;
        }

        isRecorded = true;
        appendFileSync(
          logPath,
          `${new Date().toISOString()} port=${port} server=${serverName}\n`,
        );
        socket.destroy();
      };

      socket.setTimeout(FIRST_BYTES_TIMEOUT_MS, () => record('no-data'));
      socket.once('data', (bytes) => record(extractServerName(bytes)));
      socket.on('error', () => socket.destroy());
    })
    .listen(port, '0.0.0.0', () => console.log(`Sink listening on port ${port}`));
}
