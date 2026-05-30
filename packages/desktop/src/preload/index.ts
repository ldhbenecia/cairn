import { contextBridge, ipcRenderer } from 'electron';

const IS_PACKAGED = process.argv.includes('--cairn-packaged');

export type CoreMode = 'daily' | 'weekly' | 'monthly';

export type CoreRunOptions = { backfillDays?: number };

export type PublishKind = 'created' | 'recreated' | 'skipped' | 'no-target' | null;

export type RunStep = 'boot' | 'collect' | 'summarize' | 'publish' | 'done';

export type ConfigResult = { raw: string | null; parsed: unknown; path: string };
export type LogTailResult = { lines: string[]; path: string | null };

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
  version: '0.1.1',
  isPackaged: IS_PACKAGED,
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
  onRunStep: (cb: (payload: { mode: CoreMode; step: RunStep }) => void): (() => void) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      payload: { mode: CoreMode; step: RunStep },
    ): void => cb(payload);
    ipcRenderer.on('cairn:run-step', listener);
    return () => ipcRenderer.off('cairn:run-step', listener);
  },
  readConfig: (): Promise<ConfigResult> =>
    ipcRenderer.invoke('cairn:config:read') as Promise<ConfigResult>,
  tailLogs: (): Promise<LogTailResult> =>
    ipcRenderer.invoke('cairn:logs:tail') as Promise<LogTailResult>,
});
