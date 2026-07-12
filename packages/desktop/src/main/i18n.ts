import { readSettings, type Language } from './settings';

// main 프로세스는 렌더러 i18n 번들을 못 쓰므로 알림·트레이용 문자열만 둔다. 키 누락 시 ko fallback
const STRINGS = {
  ko: {
    'mode.daily': '오늘 일지',
    'mode.weekly': '이번 주 정리',
    'mode.monthly': '이번 달 정리',

    'notify.failSuffix': '실패',
    'notify.fail.auth': '토큰 인증 실패 — 연결 탭에서 확인',
    'notify.fail.quota': 'Claude 세션/쿼터 한도 — 잠시 후 재시도',
    'notify.fail.network': '네트워크 오류 — 연결 확인 후 재시도',
    'notify.fail.notion': 'Notion 발행 거부 — 워크스페이스 권한 확인',
    'notify.fail.collect': '활동 수집 실패 — 계정 연결 상태 확인',
    'notify.noTarget': '발행 대상 없음 — Preferences 설정 확인',
    'notify.noActivity': '활동 없음 — 발행 안 함',
    'notify.skipped': '이미 발행됨 — 클릭하면 앱에서 확인',
    'notify.doneSuffix': '발행 완료',
    'notify.doneBody': '클릭하면 앱에서 결과 확인',
    'notify.localDoneSuffix': '로컬 일지 저장 완료',
    'notify.localDoneBody': '노션 미연동 — 클릭하면 앱에서 결과 확인',
    'notify.summaryFailedSuffix': '요약 실패',
    'notify.summaryFailedBody': 'Claude 세션/쿼터를 확인한 뒤 다시 발행하세요',
    'notify.autoTitle': 'cairn 자동 발행',
    'notify.autoRunning': '{mode}를 발행하는 중이에요',
    'notify.autoConfirmTitle': 'cairn 자동 발행 대기',
    'notify.autoConfirm': '{mode}를 발행할까요? 클릭해서 확인',
    'notify.testTitle': 'cairn 알림 테스트',
    'notify.testBody': '이 알림이 보이면 발행 완료 알림도 정상으로 떠요',

    'capture.deeplinkTitle': '퀵 캡처',
    'capture.deeplinkSaved': '메모 저장됨 — 발행 시 일지에 병합',
    'capture.deeplinkFail': '메모 저장 안 됨 — 비어 있거나 300자 초과',

    'tray.tooltip': 'cairn — 자동 작업 일지',
    'tray.daily': '오늘 일지 발행',
    'tray.weekly': '이번 주 정리',
    'tray.monthly': '이번 달 정리',
    'tray.capture': '퀵 캡처',
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
    'notify.fail.auth': 'Token auth failed — check Connections',
    'notify.fail.quota': 'Claude session/quota limit — retry later',
    'notify.fail.network': 'Network error — check connection and retry',
    'notify.fail.notion': 'Notion rejected the publish — check workspace access',
    'notify.fail.collect': 'Collection failed — check account connections',
    'notify.noTarget': 'No publish target — check Preferences',
    'notify.noActivity': 'No activity — nothing published',
    'notify.skipped': 'Already published — click to view in the app',
    'notify.doneSuffix': 'published',
    'notify.doneBody': 'Click to see the result in the app',
    'notify.localDoneSuffix': 'saved to local journal',
    'notify.localDoneBody': 'Notion not connected — click to see the result in the app',
    'notify.summaryFailedSuffix': 'summary failed',
    'notify.summaryFailedBody': 'Check your Claude session/quota, then publish again',
    'notify.autoTitle': 'cairn auto-publish',
    'notify.autoRunning': 'Publishing {mode}…',
    'notify.autoConfirmTitle': 'cairn auto-publish — confirm',
    'notify.autoConfirm': 'Publish {mode}? Click to confirm',
    'notify.testTitle': 'cairn notification test',
    'notify.testBody': 'If you can see this, publish notifications work too',

    'capture.deeplinkTitle': 'Quick capture',
    'capture.deeplinkSaved': 'Memo saved — merged at publish',
    'capture.deeplinkFail': 'Memo not saved — empty or over 300 chars',

    'tray.tooltip': 'cairn — automatic worklog',
    'tray.daily': 'Publish today',
    'tray.weekly': "This week's rollup",
    'tray.monthly': "This month's rollup",
    'tray.capture': 'Quick capture',
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
