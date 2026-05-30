import type { NavKey } from './sidebar';

const TITLE: Record<NavKey, string> = {
  today: '오늘 일지',
  week: '이번 주 정리',
  month: '이번 달 정리',
  recent: '최근 노션 페이지',
  logs: '로그',
  settings: '설정',
};

type Props = {
  active: NavKey;
};

export function Content({ active }: Props) {
  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-canvas">
      <div className="h-14 [-webkit-app-region:drag]" />
      <header className="px-8 pt-2 pb-6">
        <h1 className="font-sans text-[22px] font-medium leading-tight tracking-[-0.4px] text-ink">
          {TITLE[active]}
        </h1>
      </header>
      <div className="flex flex-1 items-center justify-center text-[12px] leading-[1.4] text-ink-tertiary">
        14.4 부터 채워짐
      </div>
    </section>
  );
}
