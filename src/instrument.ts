import * as Sentry from "@sentry/node";

const ALL_SAMPLES = 1;

if ("SENTRY_DSN" in process.env && "SENTRY_ENVIRONMENT" in process.env) {
	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		tracesSampleRate: ALL_SAMPLES,
		environment: process.env.SENTRY_ENVIRONMENT,
	});
}
