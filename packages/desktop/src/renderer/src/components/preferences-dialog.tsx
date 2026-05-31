import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import type { ConfigResult } from '../cairn-api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PreferencesDialog({ open, onOpenChange }: Props) {
  const [result, setResult] = useState<ConfigResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await window.cairn.readConfig();
    setResult(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="dialog-content fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-160 max-w-[90vw] flex-col rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
            <Dialog.Title className="text-[16px] font-semibold tracking-[-0.2px] text-ink">
              Preferences
            </Dialog.Title>
            <Dialog.Close className="flex size-7 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink">
              <X size={15} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
            <section>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
                About
              </h3>
              <div className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-4 py-3 text-[13px]">
                <span className="text-ink-muted">cairn</span>
                <span className="font-mono text-ink-subtle">v{window.cairn.version}</span>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-3">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
                  설정 파일
                </h3>
                {result && (
                  <span className="truncate font-mono text-[11px] text-ink-tertiary">
                    {result.path}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                >
                  <RefreshCw size={12} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
                  새로고침
                </button>
              </div>
              {result?.raw ? (
                <pre className="max-h-72 overflow-auto rounded-lg border border-hairline bg-surface-2 p-4 font-mono text-[12px] leading-relaxed text-ink-muted">
                  {result.raw}
                </pre>
              ) : (
                result && (
                  <div className="rounded-lg border border-hairline bg-surface-2 p-5 text-[13px] text-ink-muted">
                    파일이 위 경로에 없습니다. 한 번 셋업이 필요해요:
                    <pre className="mt-3 overflow-auto rounded-md bg-canvas p-3 font-mono text-[12px] text-ink-subtle">{`mkdir -p ~/.cairn\ncp worklog.config.json .env ~/.cairn/`}</pre>
                  </div>
                )
              )}
              <p className="mt-3 text-[12px] text-ink-tertiary">GUI 편집은 v0.2 셋업 마법사부터.</p>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
