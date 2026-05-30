import { FileText } from 'lucide-react';

export function RecentPanel() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-8 [-webkit-app-region:no-drag]">
      <div className="max-w-sm space-y-4 text-center">
        <FileText size={28} strokeWidth={1.5} className="mx-auto text-ink-tertiary" />
        <h2 className="font-sans text-[16px] font-medium tracking-tight text-ink">v0.5+ 에 등장</h2>
        <p className="text-[13px] leading-relaxed text-ink-subtle">
          노션 DB 의 일지 / 롤업 목록을 앱 안에서 조회하고, 클릭 시 오른쪽 패널에 본문을 slide-in
          으로 띄워 인앱 편집까지. 변경 사항은 노션 API 로 push back.
        </p>
        <p className="text-[12px] text-ink-tertiary">
          현재는 발행 시점에 RunPanel 의 결과 박스에서 노션 페이지 링크로 이동.
        </p>
      </div>
    </div>
  );
}
