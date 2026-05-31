import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, SettingsProvider } from './settings-context';
import './styles.css';

// 무플래시: 첫 페인트 전에 초기 테마 적용
applyTheme(window.cairn.initialSettings.theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>,
);
