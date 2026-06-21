import Link from 'next/link';

const previews = [
  { href: '/preview/bento', label: 'Bento Grid', desc: '랜딩 카드 후보' },
  { href: '/preview/dotted', label: 'Dotted Surface', desc: 'three.js 도트 배경' },
  { href: '/preview/sign-in', label: 'Sign-in Flow', desc: '셰이더 로그인 화면 (데모)' },
  { href: '/preview/agent-plan', label: 'Agent Plan', desc: '발행 진행 애니메이션 후보' },
];

export default function PreviewIndex() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-2xl font-semibold tracking-tight">UI 컴포넌트 프리뷰</h1>
      <p className="mt-2 text-ink-subtle">받은 컴포넌트 4종을 그대로 띄운 미리보기. 실제 페이지는 안 건드림.</p>
      <ul className="mt-8 space-y-3">
        {previews.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="block rounded-lg border border-hairline bg-surface-1 px-5 py-4 transition-colors hover:border-hairline-strong"
            >
              <div className="font-medium">{p.label}</div>
              <div className="text-sm text-ink-subtle">{p.desc}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
