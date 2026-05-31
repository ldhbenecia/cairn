import { BrowserWindow, Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron';
import { runCore, type CoreMode } from './core-runner';
import { TRAY_ICON_1X, TRAY_ICON_2X } from './tray-icon';

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

export function setupTray(window: BrowserWindow, onQuit: () => void): void {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip('cairn — 자동 작업 일지');

  const menu = buildMenu(window, onQuit);
  tray.on('right-click', () => tray?.popUpContextMenu(menu));
  tray.on('click', () => showWindow(window));
}

function buildMenu(window: BrowserWindow, onQuit: () => void): Menu {
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
    { type: 'separator' },
    {
      label: 'cairn 완전 종료',
      click: () => onQuit(),
    },
  ];

  return Menu.buildFromTemplate(items);
}

function showWindow(window: BrowserWindow): void {
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
