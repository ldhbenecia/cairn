import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('cairn', {
  version: '0.0.1',
});
