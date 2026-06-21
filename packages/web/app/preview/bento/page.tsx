import { BentoGrid, type BentoItem } from '@/components/ui/bento-grid';
import { GitPullRequest, FileText, CalendarDays, ShieldCheck, BarChart3 } from 'lucide-react';

const items: BentoItem[] = [
  {
    title: 'Aggregate',
    meta: 'GitHub + local Git',
    description:
      'GitHub PRs (authored + assigned) and local Git commits across multiple repos and accounts',
    icon: <GitPullRequest className="w-4 h-4 text-blue-500" />,
    status: 'Core',
    tags: ['GitHub', 'Local Git'],
    colSpan: 2,
    hasPersistentHover: true,
  },
  {
    title: 'Summarize',
    meta: 'Claude Agent SDK',
    description: 'Claude writes the worklog in your language — Korean or English',
    icon: <FileText className="w-4 h-4 text-emerald-500" />,
    status: 'AI',
    tags: ['Claude', 'KO/EN'],
  },
  {
    title: 'Publish',
    meta: 'daily · weekly · monthly',
    description: 'Daily logs to Notion with automatic weekly and monthly rollups',
    icon: <CalendarDays className="w-4 h-4 text-purple-500" />,
    status: 'Notion',
    tags: ['Notion', 'Rollups'],
    colSpan: 2,
  },
  {
    title: 'Local-first & private',
    meta: 'no code egress',
    description: 'Machine-local secrets, no server, no code-body or diff ever leaves your machine',
    icon: <ShieldCheck className="w-4 h-4 text-sky-500" />,
    status: 'Privacy',
    tags: ['Local', 'Whitelist'],
  },
  {
    title: 'Stats dashboard',
    meta: 'streaks & trends',
    description: 'In-app dashboard with cross-device sync of your daily activity counts',
    icon: <BarChart3 className="w-4 h-4 text-amber-500" />,
    status: 'App',
    tags: ['Dashboard', 'Sync'],
    colSpan: 2,
  },
];

export default function BentoPreview() {
  return (
    <main className="min-h-screen py-16">
      <BentoGrid items={items} />
    </main>
  );
}
