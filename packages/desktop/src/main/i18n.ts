import { readSettings, type Language } from './settings';

// main 프로세스 전용 경량 i18n — 렌더러 i18n(별도 번들)을 못 쓰므로 알림·트레이용 문자열만 둔다.
// 현재 언어는 settings.json 의 language. 키 누락 시 ko fallback.
const STRINGS = {
  ko: {
    'mode.daily': '오늘 일지',
    'mode.weekly': '이번 주 정리',
    'mode.monthly': '이번 달 정리',

    'notify.failSuffix': '실패',
    'notify.noTarget': '발행 대상 없음 — Preferences 설정 확인',
    'notify.noActivity': '활동 없음 — 발행 안 함',
    'notify.skipped': '이미 발행됨 — 클릭하면 앱에서 확인',
    'notify.doneSuffix': '발행 완료',
    'notify.doneBody': '클릭하면 앱에서 결과 확인',
    'notify.autoTitle': 'cairn 자동 발행',
    'notify.autoRunning': '{mode}를 발행하는 중이에요',
    'notify.autoConfirmTitle': 'cairn 자동 발행 대기',
    'notify.autoConfirm': '{mode}를 발행할까요? 클릭해서 확인',
    'notify.testTitle': 'cairn 알림 테스트',
    'notify.testBody': '이 알림이 보이면 발행 완료 알림도 정상으로 떠요',

    'tray.tooltip': 'cairn — 자동 작업 일지',
    'tray.daily': '오늘 일지 발행',
    'tray.weekly': '이번 주 정리',
    'tray.monthly': '이번 달 정리',
    'tray.dashboard': '대시보드 열기',
    'tray.quit': 'cairn 완전 종료',

    'updater.title': '새 버전이 있어요',
    'updater.body': 'cairn {version} — 클릭하면 다운로드 페이지로',
  },
  en: {
    'mode.daily': "Today's worklog",
    'mode.weekly': "This week's rollup",
    'mode.monthly': "This month's rollup",

    'notify.failSuffix': 'failed',
    'notify.noTarget': 'No publish target — check Preferences',
    'notify.noActivity': 'No activity — nothing published',
    'notify.skipped': 'Already published — click to view in the app',
    'notify.doneSuffix': 'published',
    'notify.doneBody': 'Click to see the result in the app',
    'notify.autoTitle': 'cairn auto-publish',
    'notify.autoRunning': 'Publishing {mode}…',
    'notify.autoConfirmTitle': 'cairn auto-publish — confirm',
    'notify.autoConfirm': 'Publish {mode}? Click to confirm',
    'notify.testTitle': 'cairn notification test',
    'notify.testBody': 'If you can see this, publish notifications work too',

    'tray.tooltip': 'cairn — automatic worklog',
    'tray.daily': 'Publish today',
    'tray.weekly': "This week's rollup",
    'tray.monthly': "This month's rollup",
    'tray.dashboard': 'Open dashboard',
    'tray.quit': 'Quit cairn',

    'updater.title': 'A new version is available',
    'updater.body': 'cairn {version} — click to open the download page',
  },
} as const;

type MainI18nKey = keyof (typeof STRINGS)['ko'];

export function mt(key: MainI18nKey, vars?: Record<string, string>, lang?: Language): string {
  const l = lang ?? readSettings().language;
  let s: string = STRINGS[l]?.[key] ?? STRINGS.ko[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
