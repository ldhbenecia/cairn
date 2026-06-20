import type { Metadata } from 'next';
import { LegalSection, LegalShell } from '../../components/legal-shell';

export const metadata: Metadata = {
  title: 'Privacy Policy · cairn',
  description: 'How cairn handles your data.',
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 20, 2026">
      <p>
        cairn is a local-first desktop app that turns your daily development activity into a worklog
        published to Notion. This policy explains what data cairn handles and what — if anything —
        leaves your machine.
      </p>

      <LegalSection heading="What stays on your device">
        <p>
          Your worklogs, source code, diffs, file paths, commit messages, repository names, and the
          access tokens you connect (GitHub, Notion, Anthropic) stay on your computer. cairn never
          sends source code or diffs to us or to any third party beyond the services you explicitly
          configure.
        </p>
      </LegalSection>

      <LegalSection heading="Google Sign-In (optional)">
        <p>
          Cross-device sync is optional. If you enable it, you sign in with Google. We receive your
          basic Google profile — name, email address, and profile picture — solely to identify your
          account across devices. We do not access your Google data beyond this.
        </p>
      </LegalSection>

      <LegalSection heading="What syncs across devices">
        <p>
          When sync is enabled, only <strong>aggregate statistics</strong> are stored on our server:
          dates, category (daily/weekly/monthly), pull-request and commit counts, and a per-hour
          activity histogram — the same numbers already shown on your dashboard.
        </p>
        <p>
          We never sync source code, diffs, file paths, repository names, commit messages, worklog
          contents, or any access tokens. These fields do not exist in the sync schema.
        </p>
      </LegalSection>

      <LegalSection heading="Where data is stored">
        <p>
          Account and synced statistics are stored in a managed PostgreSQL database (Supabase).
          Authentication is handled by Better Auth on our web backend. Data is transmitted over
          HTTPS.
        </p>
      </LegalSection>

      <LegalSection heading="Anonymous usage telemetry">
        <p>
          The desktop app sends anonymous telemetry (PostHog) to understand usage: a random install
          id, app version, OS/architecture, and event names (such as app launch and publish
          outcome). It contains no worklog content, titles, repository names, paths, or tokens. You
          can turn it off in Preferences → About.
        </p>
      </LegalSection>

      <LegalSection heading="Third-party services you connect">
        <p>
          cairn talks directly to Notion, GitHub, and Anthropic (Claude) using tokens you provide.
          That data flows according to your own configuration and those services&apos; policies — not
          through us.
        </p>
      </LegalSection>

      <LegalSection heading="Retention and deletion">
        <p>
          Signing out removes the local session. You can request deletion of your account and synced
          statistics at any time by contacting us; removing your account deletes the associated
          synced data.
        </p>
      </LegalSection>

      <LegalSection heading="No sale of data">
        <p>We do not sell or rent your personal information.</p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          We may update this policy; material changes will be reflected here with a new date.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions or deletion requests:{' '}
          <a className="text-accent-hover hover:text-accent" href="mailto:cairnlog@gmail.com">
            cairnlog@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
