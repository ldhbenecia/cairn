import {
  BrowserWindow,
  Menu,
  nativeImage,
  shell,
  Tray,
  type MenuItemConstructorOptions,
} from 'electron';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { runCore, type CoreMode } from './core-runner';
import { TRAY_ICON_1X, TRAY_ICON_2X } from './tray-icon';

const LOG_DIR = join(homedir(), '.cairn', 'logs');

function buildTrayIcon(): Electron.NativeImage {
  const img = nativeImage.createFromDataURL(TRAY_ICON_1X);
  img.addRepresentation({ scaleFactor: 2, dataURL: TRAY_ICON_2X });
  img.setTemplateImage(true);
  return img;
}

function triggerCore(window: BrowserWindow, mode: CoreMode): void {
  void runCore(mode, {}, window.webContents).then((result) => {
    if (!result.ok) {
      console.error(`[cairn] ${mode} failed:\n${result.stderrTail}`);
    }
  });
}

let tray: Tray | null = null;

export function setupTray(window: BrowserWindow): void {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip('cairn — 자동 작업 일지');

  const menu = buildMenu(window);
  tray.on('right-click', () => tray?.popUpContextMenu(menu));
  tray.on('click', () => showWindow(window));
}

function buildMenu(window: BrowserWindow): Menu {
  const items: MenuItemConstructorOptions[] = [
    {
      label: '오늘 일지 발행',
      accelerator: 'CommandOrControl+1',
      click: () => triggerCore(window, 'daily'),
    },
    {
      label: '이번 주 정리',
      accelerator: 'CommandOrControl+2',
      click: () => triggerCore(window, 'weekly'),
    },
    {
      label: '이번 달 정리',
      accelerator: 'CommandOrControl+3',
      click: () => triggerCore(window, 'monthly'),
    },
    { type: 'separator' },
    {
      label: '대시보드 열기',
      accelerator: 'CommandOrControl+D',
      click: () => showWindow(window),
    },
    {
      label: '로그 폴더 열기',
      click: () => {
        void shell.openPath(LOG_DIR);
      },
    },
    {
      label: '최근 노션 페이지',
      enabled: false,
      sublabel: '14.6 에서 활성',
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'CommandOrControl+Q',
      role: 'quit',
    },
  ];

  return Menu.buildFromTemplate(items);
}

function showWindow(window: BrowserWindow): void {
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
