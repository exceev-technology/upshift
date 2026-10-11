import http from 'node:http';
let received = 0;
http
  .createServer((request, response) => {
    request.resume();
    if (request.method === 'POST') received++;
    response.end(JSON.stringify({ received }));
  })
  .listen(8080, '0.0.0.0');
