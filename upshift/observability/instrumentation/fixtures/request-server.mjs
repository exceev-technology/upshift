import http from 'node:http';

import { requestObservability } from '../preload.mjs';

const server = http.createServer((request, response) => {
  request.resume();
  response.statusCode = new URL(
    request.url,
    'http://localhost',
  ).searchParams.has('fail')
    ? 500
    : 200;
  response.end('application response remains intact');
});

server.listen(0, '127.0.0.1', () =>
  process.send({ port: server.address().port }),
);
process.on('message', async (message) => {
  if (message === 'flush') {
    await requestObservability?.flush();
    process.send({ flushed: true });
  }
  if (message === 'close') {
    requestObservability?.close();
    server.close(() => process.exit(0));
  }
});
