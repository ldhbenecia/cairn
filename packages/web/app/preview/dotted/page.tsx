import { DottedSurface } from '@/components/ui/dotted-surface';
import { cn } from '@/lib/utils';

export default function DottedPreview() {
  return (
    <>
      {/* body 다크 배경에 가리지 않도록 -z-1 대신 z-0 으로 콘텐츠 레이어에 올림 */}
      <DottedSurface className="z-0" />
      <div className="relative z-10 flex min-h-screen items-center justify-center">
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full',
            'bg-[radial-gradient(ellipse_at_center,rgba(97,102,241,0.18),transparent_60%)] blur-[30px]',
          )}
        />
        <h1 className="font-mono text-4xl font-semibold text-ink">Dotted Surface</h1>
      </div>
    </>
  );
}
