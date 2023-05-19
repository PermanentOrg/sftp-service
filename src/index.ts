import * as Sentry from '@sentry/node';
import { server } from './server';
import { logger } from './logger';
import { SystemConfigurationError } from './errors';
import type { ListenOptions } from 'net';

if ('SENTRY_DSN' in process.env
 && 'SENTRY_ENVIRONMENT' in process.env) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1,
    environment: process.env.SENTRY_ENVIRONMENT,
  });
}

if (process.env.TEMPORARY_FILE_S3_BUCKET === undefined) {
  throw new SystemConfigurationError('TEMPORARY_FILE_S3_BUCKET must be populated in order to upload to s3.');
}
if (process.env.AWS_ACCESS_KEY_ID === undefined) {
  throw new SystemConfigurationError('AWS_ACCESS_KEY_ID must be populated in order to upload to s3.');
}
if (process.env.AWS_ACCESS_SECRET === undefined) {
  throw new SystemConfigurationError('AWS_ACCESS_SECRET must be populated in order to upload to s3.');
}
if (process.env.TEMPORARY_FILE_S3_BUCKET_REGION === undefined) {
  throw new SystemConfigurationError('TEMPORARY_FILE_S3_BUCKET_REGION must be populated in order to upload to s3.');
}

const listenOptions: ListenOptions = {
  port: Number.parseInt(process.env.SSH_PORT ?? '22', 10),
  host: process.env.SSH_HOST ?? '127.0.0.1',
};

server.listen(
  listenOptions,
  () => logger.info(`Listening for SSH requests on ${listenOptions.host ?? ''}:${listenOptions.port ?? ''}`),
);
