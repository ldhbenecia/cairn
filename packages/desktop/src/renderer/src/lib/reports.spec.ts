import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildLanes,
  dayIndex,
  daySpan,
  parseDoneBullet,
  parseDoneItems,
  timelineAxis,
} from './reports';

describe('parseDoneBullet', () => {
  it('[repo] 프리픽스 — repo 와 본문 분리', () => {
    expect(parseDoneBullet('2026-07-01', '[cairn] 대시보드 정리')).toEqual({
      date: '2026-07-01',
      repo: 'cairn',
      text: '대시보드 정리',
    });
  });

  it('계정 라벨이 앞에 붙으면 두 번째 것이 repo', () => {
    expect(parseDoneBullet('2026-07-01', '[work] [api] 배포 스크립트')).toEqual({
      date: '2026-07-01',
      repo: 'api',
      text: '배포 스크립트',
    });
  });

  it('프리픽스 없으면 repo=null, 본문 그대로', () => {
    expect(parseDoneBullet('2026-07-01', '문서 리뷰')).toEqual({
      date: '2026-07-01',
      repo: null,
      text: '문서 리뷰',
    });
  });

  it('볼드 프리픽스 — **[repo]** 와 [**repo**] 모두 인식', () => {
    expect(parseDoneBullet('2026-07-01', '**[cairn]** 대시보드 정리')).toEqual({
      date: '2026-07-01',
      repo: 'cairn',
      text: '대시보드 정리',
    });
    expect(parseDoneBullet('2026-07-01', '[**cairn**] 대시보드 정리')).toEqual({
      date: '2026-07-01',
      repo: 'cairn',
      text: '대시보드 정리',
    });
  });

  it('마크다운 링크 프리픽스 — URL 은 버리고 라벨만', () => {
    expect(
      parseDoneBullet('2026-07-01', '[cairn](https://github.com/x/cairn) 릴리스 0.27.1'),
    ).toEqual({ date: '2026-07-01', repo: 'cairn', text: '릴리스 0.27.1' });
  });

  it('공백 변형 — 괄호 안 공백·브래킷 사이 다중 공백', () => {
    expect(parseDoneBullet('2026-07-01', '[ Personal ]   [cairn]  스냅샷 복구')).toEqual({
      date: '2026-07-01',
      repo: 'cairn',
      text: '스냅샷 복구',
    });
  });

  it('계정 라벨 + bare repo — `[label] repo — text` 는 repo 가 레포', () => {
    expect(parseDoneBullet('2026-07-01', '[ldhbenecia] cairn — 날짜 윈도우 수정')).toEqual({
      date: '2026-07-01',
      repo: 'cairn',
      text: '날짜 윈도우 수정',
    });
  });

  it('계정 라벨 + bare repo + PR 번호 — 번호는 본문에 남는다', () => {
    expect(parseDoneBullet('2026-07-01', '[Work] AdminServer #244 — 배너 연동')).toEqual({
      date: '2026-07-01',
      repo: 'AdminServer',
      text: '#244 배너 연동',
    });
  });

  it('브래킷 없는 bare repo — 신뢰 집합에 있을 때만 레포', () => {
    expect(
      parseDoneBullet('2026-07-01', 'team-api — fix quiz chunking', new Set(['team-api'])),
    ).toEqual({
      date: '2026-07-01',
      repo: 'team-api',
      text: 'fix quiz chunking',
    });
    expect(parseDoneBullet('2026-07-01', 'RollupPublisherService — 재시도 정리')).toEqual({
      date: '2026-07-01',
      repo: null,
      text: 'RollupPublisherService — 재시도 정리',
    });
  });

  it('bare repo — ASCII 하이픈 구분자도 dash 와 동일 취급, 첫 구분자 기준', () => {
    expect(
      parseDoneBullet(
        '2026-07-01',
        'cairn - 일지 발행 진행 화면 풀 리디자인 — 단계 재구성',
        new Set(['cairn']),
      ),
    ).toEqual({
      date: '2026-07-01',
      repo: 'cairn',
      text: '일지 발행 진행 화면 풀 리디자인 — 단계 재구성',
    });
  });

  it('신뢰 레포명 공백/대소문자 변형 — 정규화 정확 일치로 귀속', () => {
    expect(
      parseDoneBullet(
        '2026-07-01',
        'Cashwalk Backend: 정산 배치 개선',
        new Set(['CashwalkBackend']),
      ),
    ).toEqual({
      date: '2026-07-01',
      repo: 'CashwalkBackend',
      text: '정산 배치 개선',
    });
  });

  it('부분 생략형 — 후보 토큰이 신뢰 레포명에 순서대로 포함되면 귀속', () => {
    expect(
      parseDoneBullet(
        '2026-07-01',
        'Cashwalk AdminServer: 배너 연동',
        new Set(['CashwalkTeamwalkAdminServer']),
      ),
    ).toEqual({
      date: '2026-07-01',
      repo: 'CashwalkTeamwalkAdminServer',
      text: '배너 연동',
    });
  });

  it('짧은 단일 단어는 부분 매칭 미적용 — fix 는 기타 유지', () => {
    expect(
      parseDoneBullet('2026-07-01', 'fix: 퀴즈 청킹 보정', new Set(['HotfixService'])),
    ).toEqual({
      date: '2026-07-01',
      repo: null,
      text: 'fix: 퀴즈 청킹 보정',
    });
  });

  it('콜론 프리픽스 — 신뢰 집합 정확 일치만 레포, 불일치는 기타', () => {
    expect(
      parseDoneBullet(
        '2026-07-01',
        'Cashwalk AdminServer: 배너·가드 정합',
        new Set(['Cashwalk AdminServer']),
      ),
    ).toEqual({
      date: '2026-07-01',
      repo: 'Cashwalk AdminServer',
      text: '배너·가드 정합',
    });
    expect(parseDoneBullet('2026-07-01', 'fix: 퀴즈 청킹 보정')).toEqual({
      date: '2026-07-01',
      repo: null,
      text: 'fix: 퀴즈 청킹 보정',
    });
    expect(parseDoneBullet('2026-07-01', 'CMS: 배너 편집 화면')).toEqual({
      date: '2026-07-01',
      repo: null,
      text: 'CMS: 배너 편집 화면',
    });
  });

  it('신뢰 레포명+공백+단어 콜론 — 해당 신뢰 레포로 귀속 (cairn desktop → cairn)', () => {
    expect(
      parseDoneBullet(
        '2026-07-01',
        'cairn desktop: core-runner I/O 최적화 — 로그',
        new Set(['cairn']),
      ),
    ).toEqual({
      date: '2026-07-01',
      repo: 'cairn',
      text: 'desktop: core-runner I/O 최적화 — 로그',
    });
  });

  it('한글로 시작하는 문장은 em-dash 가 있어도 기타(null)', () => {
    expect(parseDoneBullet('2026-07-01', '로컬 일지 저장소(journal) — 마크다운 저장')).toEqual({
      date: '2026-07-01',
      repo: null,
      text: '로컬 일지 저장소(journal) — 마크다운 저장',
    });
  });

  it('라벨 하나 + 콜론/대시 매치 없음 — 라벨이 레포로 남는 기존 동작 유지', () => {
    expect(parseDoneBullet('2026-07-01', '[Personal] Tier 1 완성: 스탠드업 스니펫')).toEqual({
      date: '2026-07-01',
      repo: 'Personal',
      text: 'Tier 1 완성: 스탠드업 스니펫',
    });
  });
});

describe('parseDoneItems — 2-pass', () => {
  it('대괄호가 확정한 레포만 콜론/bare 를 귀속시킨다 — fix·서비스명은 기타', () => {
    const items = parseDoneItems([
      { date: '2026-07-01', bullets: ['[cairn] 타임라인 정리', 'cairn desktop: 캡처 제거'] },
      { date: '2026-07-02', bullets: ['fix: 퀴즈 청킹', 'RollupPublisherService — 재시도'] },
    ]);
    expect(items.map((i) => i.repo)).toEqual(['cairn', 'cairn', null, null]);
  });

  it('[label] repo — text 의 bare repo 도 신뢰 집합에 들어간다', () => {
    const items = parseDoneItems([
      {
        date: '2026-07-01',
        bullets: ['[Work] AdminServer #244 — 배너 연동', 'AdminServer — 가드 정리'],
      },
    ]);
    expect(items.map((i) => i.repo)).toEqual(['AdminServer', 'AdminServer']);
  });
});

describe('날짜 산술', () => {
  it('dayIndex / daySpan — 경계 포함', () => {
    expect(dayIndex('2026-07-01', '2026-07-01')).toBe(0);
    expect(dayIndex('2026-07-01', '2026-07-18')).toBe(17);
    expect(daySpan('2026-07-01', '2026-07-18')).toBe(18);
  });

  it('addDays — 월 경계를 넘는다', () => {
    expect(addDays('2026-06-29', 3)).toBe('2026-07-02');
  });
});

describe('buildLanes', () => {
  it('항목 수 내림차순, 프리픽스 없는 묶음은 마지막', () => {
    const lanes = buildLanes([
      { date: '2026-07-01', repo: 'a', text: 'x' },
      { date: '2026-07-02', repo: 'b', text: 'x' },
      { date: '2026-07-03', repo: 'b', text: 'x' },
      { date: '2026-07-01', repo: null, text: 'x' },
    ]);
    expect(lanes.map((l) => l.repo)).toEqual(['b', 'a', null]);
    expect(lanes[0]!.dates).toEqual(['2026-07-02', '2026-07-03']);
    expect(lanes[0]!.count).toBe(2);
  });

  it('peaks — 2건 이상인 날만 건수순 상위 2곳', () => {
    const lanes = buildLanes([
      { date: '2026-07-01', repo: 'a', text: 'x' },
      { date: '2026-07-02', repo: 'a', text: 'x' },
      { date: '2026-07-02', repo: 'a', text: 'x' },
      { date: '2026-07-02', repo: 'a', text: 'x' },
      { date: '2026-07-04', repo: 'a', text: 'x' },
      { date: '2026-07-04', repo: 'a', text: 'x' },
      { date: '2026-07-06', repo: 'a', text: 'x' },
      { date: '2026-07-06', repo: 'a', text: 'x' },
    ]);
    expect(lanes[0]!.peaks).toEqual([
      { date: '2026-07-02', count: 3 },
      { date: '2026-07-04', count: 2 },
    ]);
  });

  it('peaks — 전부 1건이면 비어 있음', () => {
    const lanes = buildLanes([
      { date: '2026-07-01', repo: 'a', text: 'x' },
      { date: '2026-07-02', repo: 'a', text: 'x' },
    ]);
    expect(lanes[0]!.peaks).toEqual([]);
  });
});

describe('timelineAxis', () => {
  it('월 라벨 — 기간 시작 + 매월 1일', () => {
    const { months } = timelineAxis('2026-05-15', '2026-07-14');
    expect(months.map((t) => t.date)).toEqual(['2026-05-15', '2026-06-01', '2026-07-01']);
    expect(months[0]!.pos).toBe(0);
  });

  it('첫 달 조각이 좁으면 시작 라벨 드랍', () => {
    const { months } = timelineAxis('2026-06-30', '2026-08-31');
    expect(months.map((t) => t.date)).toEqual(['2026-07-01', '2026-08-01']);
  });

  it('일 눈금 — 매주 월요일', () => {
    // 2026-07-06 은 월요일
    const { days } = timelineAxis('2026-07-01', '2026-07-31');
    expect(days.map((t) => t.date)).toEqual([
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
      '2026-07-27',
    ]);
    expect(days[0]!.pos).toBeCloseTo(5 / 31);
  });

  it('일 눈금 — 연 단위 기간도 주 눈금을 성기게 하지 않는다 (매주 유지)', () => {
    const { days } = timelineAxis('2025-07-19', '2026-07-18');
    expect(days).toHaveLength(52);
  });
});
