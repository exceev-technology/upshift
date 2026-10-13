import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import { setTimeout } from 'node:timers/promises';
const client = new S3Client({
  endpoint: 'http://object-storage:8333',
  region: 'us-east-1',
  forcePathStyle: true,
  maxAttempts: 1,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});
for (const bucket of [
  'upshift-logs',
  'upshift-traces',
  'upshift-metrics',
  'upshift-metrics-ruler',
  'upshift-metrics-alertmanager',
]) {
  let created = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }), {
        abortSignal: AbortSignal.timeout(3000),
      });
      created = true;
      break;
    } catch (error) {
      if (error.name === 'BucketAlreadyOwnedByYou') {
        created = true;
        break;
      }
      await setTimeout(2000);
    }
  }
  if (!created)
    throw new Error(
      'Cannot initialize monitoring buckets; check storage credentials and readiness',
    );
}
client.destroy();
