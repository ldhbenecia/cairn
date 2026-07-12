import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let captureWin: BrowserWindow | null = null;
let registeredAccelerator: string | null = null;

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

  // 메인 창과 동일한 네비게이션 잠금 — preload 브릿지의 외부 노출 차단. 캡처 창은 링크가 없어 전부 deny
  win.webContents.on('will-navigate', (e, url) => {
    const dev = process.env.ELECTRON_RENDERER_URL;
    if ((dev && url.startsWith(dev)) || url.startsWith('file://')) return;
    e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 다른 앱이 풀스크린이어도 그 위로 (Spotlight 류 퀵 입력 동작)
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.on('blur', () => win.hide());
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

// 커서가 있는 디스플레이 상단 1/5 지점에 가운데 정렬
function positionCaptureWindow(win: BrowserWindow): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea;
  const [w] = win.getSize();
  win.setPosition(Math.round(x + (width - (w ?? 560)) / 2), Math.round(y + height * 0.2));
}

export function toggleCaptureWindow(): void {
  if (captureWin?.isVisible()) {
    captureWin.hide();
    return;
  }
  const created = captureWin === null;
  const win = (captureWin ??= createCaptureWindow());
  const present = (): void => {
    positionCaptureWindow(win);
    win.show();
    win.focus();
  };
  // 첫 생성 직후엔 렌더러 로드 전이라 빈 창이 깜빡인다 — ready 후 표시
  if (created) win.once('ready-to-show', present);
  else present();
}

export function hideCaptureWindow(): void {
  captureWin?.hide();
}

// 언어 변경 시 파기 — 캡처 창은 bootstrap-sync 시점 언어로 렌더돼 다음 호출에서 새로 만든다
export function disposeCaptureWindow(): void {
  captureWin?.destroy();
  captureWin = null;
}

export function reconfigureCaptureShortcut(enabled: boolean, accelerator: string): void {
  if (registeredAccelerator) {
    try {
      globalShortcut.unregister(registeredAccelerator);
    } catch {
      // 이미 해제됨 — 무시
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
