import { randomUUID } from 'node:crypto';
import { PostHog } from 'posthog-node';
import { readSettings, writeSettings } from './settings';

declare const __WORKSPACE_VERSION__: string;

const KEY = process.env.CAIRN_POSTHOG_KEY ?? 'phc_sCEqcPmP6EduVvxNTSGGrhoMRn9jNNd4vRV7ntzWKFeM';
const HOST = process.env.CAIRN_POSTHOG_HOST ?? 'https://us.i.posthog.com';

type PublishMode = 'daily' | 'weekly' | 'monthly';
type PublishOutcome = 'ok' | 'fail' | 'no-activity';
export type PublishTrigger = 'manual' | 'scheduled';

let client: PostHog | null = null;
let distinctId = '';

function ensureInstallId(): string {
  const existing = readSettings().installId;
  if (existing) return existing;
  const fresh = randomUUID();
  writeSettings({ installId: fresh });
  return fresh;
}

function capture(event: string, properties: Record<string, string | boolean | number>): void {
  if (!client || !readSettings().telemetry) return;
  client.capture({
    distinctId,
    event,
    properties: {
      app_version: __WORKSPACE_VERSION__,
      os: process.platform,
      arch: process.arch,
      $ip: null,
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

export function trackPublish(
  mode: PublishMode,
  outcome: PublishOutcome,
  extra: { trigger?: PublishTrigger; summaryFailed?: boolean; backfillDays?: number } = {},
): void {
  const props: Record<string, string | boolean | number> = { mode, outcome };
  if (extra.trigger) props.trigger = extra.trigger;
  if (typeof extra.summaryFailed === 'boolean') props.summary_failed = extra.summaryFailed;
  if (typeof extra.backfillDays === 'number') props.backfill_days = extra.backfillDays;
  capture('publish', props);
}

export function trackOnboardingCompleted(): void {
  capture('onboarding_completed', {});
}

export function trackAutoPublishConfigured(cfg: {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
}): void {
  capture('auto_publish_configured', {
    daily: cfg.daily,
    weekly: cfg.weekly,
    monthly: cfg.monthly,
  });
}

export async function shutdownTelemetry(): Promise<void> {
  if (!client) return;
  await client.shutdown();
  client = null;
}
