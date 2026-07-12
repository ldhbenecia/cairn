import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let captureWin: BrowserWindow | null = null;
let registeredAccelerator: string | null = null;
// 첫 로드 완료 전 토글 연타 대응 — 표시 여부는 이 플래그가 진실 (빈 창 표시/hide 후 부활 방지)
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

// 커서가 있는 디스플레이 상단 1/5 지점에 가운데 정렬
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
  // 패널만 떠 있던 경우 이전 앱으로 포커스 반환 (macOS). 메인 창이 보이면 앱 활성 유지
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
    // 첫 생성 직후엔 렌더러 로드 전이라 빈 창이 깜빡인다 — ready 후, 그 사이 취소 안 됐을 때만 표시
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
