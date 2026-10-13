import http from 'node:http';

import {
  createRequestTelemetry,
  readObservabilityConfiguration,
} from './telemetry.mjs';

export const installRequestObservability = (environment = process.env) => {
  const configuration = readObservabilityConfiguration(environment);
  if (configuration === null) return null;

  const telemetry = createRequestTelemetry(configuration);
  const originalEmit = http.Server.prototype.emit;
  const emitWithObservability = function (event, ...argumentsList) {
    if (event === 'request') {
      const [request, response] = argumentsList;
      const complete = telemetry.begin(request);
      let completed = false;
      const finish = (aborted) => {
        if (completed) return;
        completed = true;
        complete(response.statusCode, aborted);
      };
      response.once('finish', () => finish(false));
      response.once('close', () => finish(!response.writableFinished));
    }
    return Reflect.apply(originalEmit, this, [event, ...argumentsList]);
  };
  http.Server.prototype.emit = emitWithObservability;
  return {
    flush: telemetry.flush,
    queueStatus: telemetry.queueStatus,
    close: () => {
      telemetry.close();
      if (http.Server.prototype.emit === emitWithObservability)
        http.Server.prototype.emit = originalEmit;
    },
  };
};

export const requestObservability = installRequestObservability();
