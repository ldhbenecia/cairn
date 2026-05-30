import { contextBridge, ipcRenderer } from 'electron';

export type CoreMode = 'daily' | 'weekly' | 'monthly';

export type CoreRunOptions = { backfillDays?: number };

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

export type CoreResult = {
  ok: boolean;
  exitCode: number | null;
  notionUrl: string | null;
  publishKind: PublishKind;
  publishPageId: string | null;
  noActivity: boolean;
  stderrTail: string;
};

export type RunLine = {
  mode: CoreMode;
  level: 'info' | 'err' | 'meta';
  line: string;
};

contextBridge.exposeInMainWorld('cairn', {
  version: '0.0.5',
  run: (mode: CoreMode, options?: CoreRunOptions): Promise<CoreResult> =>
    ipcRenderer.invoke('cairn:run', mode, options) as Promise<CoreResult>,
  running: (): Promise<boolean> => ipcRenderer.invoke('cairn:running') as Promise<boolean>,
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('cairn:open-external', url) as Promise<void>,
  onRunLine: (cb: (l: RunLine) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: RunLine): void => cb(payload);
    ipcRenderer.on('cairn:run-line', listener);
    return () => ipcRenderer.off('cairn:run-line', listener);
  },
  onFocusMode: (cb: (mode: CoreMode) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, mode: CoreMode): void => cb(mode);
    ipcRenderer.on('cairn:focus-mode', listener);
    return () => ipcRenderer.off('cairn:focus-mode', listener);
  },
});
