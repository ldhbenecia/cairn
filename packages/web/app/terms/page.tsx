import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalSection, LegalShell } from '../../components/legal-shell';

export const metadata: Metadata = {
  title: 'Terms of Service · cairn',
  description: 'Terms for using cairn.',
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="June 20, 2026">
      <p>
        By downloading, installing, or using cairn — including the optional cross-device sync service
        — you agree to these terms. If you do not agree, do not use the software or service.
      </p>

      <LegalSection heading="The software">
        <p>
          cairn is open-source software licensed under the GNU AGPL-3.0-or-later. It is provided{' '}
          <strong>&quot;as is&quot;, without warranty of any kind</strong>, express or implied. You
          use it at your own risk.
        </p>
      </LegalSection>

      <LegalSection heading="The sync service">
        <p>
          Cross-device sync is an optional hosted service provided on a best-effort basis with no
          uptime guarantee. We may change, suspend, or discontinue it at any time. It syncs only
          aggregate statistics as described in the{' '}
          <Link className="text-accent-hover hover:text-accent" href="/privacy">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Your responsibilities">
        <p>
          You are responsible for your own accounts, access tokens, and data, and for complying with
          the terms of the third-party services you connect (GitHub, Notion, Google, Anthropic). Do
          not use cairn for unlawful purposes or to abuse connected services.
        </p>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <p>
          To the maximum extent permitted by law, the maintainer is not liable for any indirect,
          incidental, or consequential damages, or for any loss of data, arising from use of the
          software or service.
        </p>
      </LegalSection>

      <LegalSection heading="Termination">
        <p>
          You may stop using cairn and delete your account at any time. We may suspend access that
          violates these terms or harms the service or other users.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>We may update these terms; continued use after changes constitutes acceptance.</p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          <a className="text-accent-hover hover:text-accent" href="mailto:cairnlog@gmail.com">
            cairnlog@gmail.com
          </a>
        </p>
      </LegalSection>
    </LegalShell>
  );
}
