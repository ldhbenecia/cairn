import { describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  app: { getPath: () => '/tmp' },
  dialog: { showSaveDialog: vi.fn() },
  BrowserWindow: vi.fn(),
  shell: {},
}));
vi.mock('electron', () => electron);

import { savePdf } from './export';

describe('savePdf', () => {
  it('rejects renderer input before opening a dialog or window', async () => {
    await expect(savePdf('../../Library/x.pdf', '<p>x</p>')).resolves.toMatchObject({
      saved: false,
    });
    await expect(savePdf(42 as unknown as string, '<p>x</p>')).resolves.toMatchObject({
      saved: false,
    });
    await expect(savePdf('a.pdf', null as unknown as string)).resolves.toMatchObject({
      saved: false,
    });
    expect(electron.dialog.showSaveDialog).not.toHaveBeenCalled();
    expect(electron.BrowserWindow).not.toHaveBeenCalled();
  });
});
