import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import { PostHog } from 'posthog-node';
import { readSettings, writeSettings } from './settings';

const KEY = process.env.CAIRN_POSTHOG_KEY ?? 'phc_sCEqcPmP6EduVvxNTSGGrhoMRn9jNNd4vRV7ntzWKFeM';
const HOST = process.env.CAIRN_POSTHOG_HOST ?? 'https://us.i.posthog.com';

type PublishMode = 'daily' | 'weekly' | 'monthly';
type PublishOutcome = 'ok' | 'fail' | 'no-activity';

let client: PostHog | null = null;
let distinctId = '';

function ensureInstallId(): string {
  const existing = readSettings().installId;
  if (existing) return existing;
  const fresh = randomUUID();
  writeSettings({ installId: fresh });
  return fresh;
}

function capture(event: string, properties: Record<string, string | boolean>): void {
  if (!client || !readSettings().telemetry) return;
  client.capture({
    distinctId,
    event,
    properties: {
      app_version: app.getVersion(),
      os: process.platform,
      arch: process.arch,
      $geoip_disable: true,
      ...properties,
    },
  });
}

export function initTelemetry(): void {
  if (!KEY) return;
  distinctId = ensureInstallId();
  client = new PostHog(KEY, { host: HOST, flushAt: 1 });
}

export function trackAppLaunched(): void {
  capture('app_launched', {});
}

export function trackPublish(mode: PublishMode, outcome: PublishOutcome): void {
  capture('publish', { mode, outcome });
}

export async function shutdownTelemetry(): Promise<void> {
  if (!client) return;
  await client.shutdown();
  client = null;
}
