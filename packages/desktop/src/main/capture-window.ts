import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let captureWin: BrowserWindow | null = null;
let registeredAccelerator: string | null = null;
// 로드 전 토글 연타 대응 — 표시 여부의 진실
let wantShow = false;

function createCaptureWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 560,
    height: 68,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: app.isPackaged ? ['--cairn-packaged'] : [],
    },
  });

  // 메인 창과 동일한 네비게이션 잠금
  win.webContents.on('will-navigate', (e, url) => {
    const dev = process.env.ELECTRON_RENDERER_URL;
    if ((dev && url.startsWith(dev)) || url.startsWith('file://')) return;
    e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.on('blur', () => {
    if (win.isVisible()) hidePanel(win);
  });
  win.on('closed', () => {
    captureWin = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/capture.html`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/capture.html'));
  }
  return win;
}

function positionCaptureWindow(win: BrowserWindow): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea;
  const [w] = win.getSize();
  win.setPosition(Math.round(x + (width - (w ?? 560)) / 2), Math.round(y + height * 0.2));
}

function present(win: BrowserWindow): void {
  positionCaptureWindow(win);
  win.show();
  win.focus();
}

function hidePanel(win: BrowserWindow): void {
  wantShow = false;
  win.hide();
  // 패널만 떠 있으면 이전 앱으로 포커스 반환 (macOS)
  if (
    process.platform === 'darwin' &&
    !BrowserWindow.getAllWindows().some((w) => w !== win && w.isVisible())
  ) {
    app.hide();
  }
}

export function toggleCaptureWindow(): void {
  if (!captureWin) {
    const win = (captureWin = createCaptureWindow());
    wantShow = true;
    // 로드 전 빈 창 방지 — ready 후 표시
    win.once('ready-to-show', () => {
      if (wantShow && captureWin === win) present(win);
    });
    return;
  }
  if (captureWin.webContents.isLoading()) {
    wantShow = !wantShow;
    return;
  }
  if (captureWin.isVisible()) hidePanel(captureWin);
  else present(captureWin);
}

export function hideCaptureWindow(): void {
  if (captureWin) hidePanel(captureWin);
}

// bootstrap 설정 렌더 — 설정 변경 시 파기·재생성
export function disposeCaptureWindow(): void {
  captureWin?.destroy();
  captureWin = null;
}

export function reconfigureCaptureShortcut(enabled: boolean, accelerator: string): void {
  if (registeredAccelerator) {
    try {
      globalShortcut.unregister(registeredAccelerator);
    } catch {
      /* 이미 해제됨 */
    }
    registeredAccelerator = null;
  }
  if (!enabled || !accelerator) return;
  try {
    if (globalShortcut.register(accelerator, toggleCaptureWindow)) {
      registeredAccelerator = accelerator;
    } else {
      console.error(`[cairn] capture shortcut register failed (in use?): ${accelerator}`);
    }
  } catch (err) {
    console.error('[cairn] capture shortcut register threw:', err);
  }
}
