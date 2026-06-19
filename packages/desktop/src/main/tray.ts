import { BrowserWindow, Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron';
import { runCore, type CoreMode } from './core-runner';
import { mt } from './i18n';
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
let trayWindow: BrowserWindow | null = null;
let trayOnQuit: (() => void) | null = null;

export function setupTray(window: BrowserWindow, onQuit: () => void): void {
  trayWindow = window;
  trayOnQuit = onQuit;
  tray = new Tray(buildTrayIcon());
  applyTrayLabels(window, onQuit);
  tray.on('click', () => showWindow(window));
}

export function reconfigureTray(): void {
  if (tray && trayWindow && trayOnQuit) applyTrayLabels(trayWindow, trayOnQuit);
}

function applyTrayLabels(window: BrowserWindow, onQuit: () => void): void {
  if (!tray) return;
  tray.setToolTip(mt('tray.tooltip'));
  const menu = buildMenu(window, onQuit);
  tray.removeAllListeners('right-click');
  tray.on('right-click', () => tray?.popUpContextMenu(menu));
}

function buildMenu(window: BrowserWindow, onQuit: () => void): Menu {
  const items: MenuItemConstructorOptions[] = [
    {
      label: mt('tray.daily'),
      accelerator: 'CommandOrControl+1',
      click: () => triggerCore(window, 'daily'),
    },
    {
      label: mt('tray.weekly'),
      accelerator: 'CommandOrControl+2',
      click: () => triggerCore(window, 'weekly'),
    },
    {
      label: mt('tray.monthly'),
      accelerator: 'CommandOrControl+3',
      click: () => triggerCore(window, 'monthly'),
    },
    { type: 'separator' },
    {
      label: mt('tray.dashboard'),
      accelerator: 'CommandOrControl+D',
      click: () => showWindow(window),
    },
    { type: 'separator' },
    {
      label: mt('tray.quit'),
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
