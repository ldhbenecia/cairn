export type Lang = 'en' | 'ko';

export const content = {
  en: {
    nav: { how: 'How it works', worklog: 'Worklog', setup: 'Setup' },
    hero: {
      badge: 'Open source · free · runs on your machine',
      h1a: 'Your daily work,',
      h1b: 'stacked into a worklog.',
      lead: 'Like a trail cairn, it stacks one mark of work each day. cairn collects your GitHub PRs and commits, summarizes them with Claude, and publishes a daily worklog to Notion — your work, documented automatically and ready to look back on.',
      download: 'Download for macOS',
      source: 'View source',
      sub: 'Apple Silicon · AGPL-3.0',
      unsigned: "Unsigned app — if macOS says it's damaged on first launch, run:",
      copyCmd: 'Copy command',
      expand: 'Expand',
    },
    how: {
      eyebrow: 'How it works',
      title: 'Collect → Summarize → Publish',
      lead: 'Three steps, fully automatic once set up.',
      steps: [
        {
          t: 'Collect',
          d: 'Your authored & assigned GitHub PRs and local Git commits for the day — across multiple accounts and repos. No code bodies ever leave your machine.',
        },
        {
          t: 'Summarize',
          d: 'Claude turns raw activity into a clean, quantified summary — what shipped, the outcome, the numbers. Runs on your own Claude login, no extra cost.',
        },
        {
          t: 'Publish',
          d: 'A dated worklog lands in Notion with a copy-paste-ready Share section. Weekly and monthly rollups are generated automatically.',
        },
      ],
    },
    highlights: {
      eyebrow: 'Highlights',
      title: 'What you get',
      lead: 'Everything cairn does, at a glance.',
      items: [
        {
          title: 'Aggregate',
          meta: 'GitHub + local Git',
          status: 'Core',
          description:
            'GitHub PRs (authored + assigned) and local Git commits across multiple repos and accounts.',
          tags: ['GitHub', 'Local Git'],
        },
        {
          title: 'Summarize',
          meta: 'Claude Agent SDK',
          status: 'AI',
          description:
            'Claude writes the worklog in your language — Korean or English — with the model you choose.',
          tags: ['Claude', 'KO/EN'],
        },
        {
          title: 'Publish',
          meta: 'daily · weekly · monthly',
          status: 'Notion',
          description: 'Daily logs to Notion with automatic weekly and monthly rollups.',
          tags: ['Notion', 'Rollups'],
        },
        {
          title: 'Desktop app',
          meta: 'macOS',
          status: 'App',
          description:
            'Guided setup, one-click and scheduled auto-publish, an in-app Notion viewer, a stats dashboard, and cross-device sync.',
          tags: ['Auto-publish', 'Dashboard'],
        },
        {
          title: 'Local-first & private',
          meta: 'no code egress',
          status: 'Privacy',
          description:
            'Machine-local secrets, no server — no code body or diff ever leaves your machine.',
          tags: ['Local', 'Whitelist'],
        },
      ],
    },
    output: {
      eyebrow: 'The output',
      title: 'A worklog that reads itself back',
      lead: 'Each day lands in Notion as a clean page — a project-level summary, a copy-paste-ready Share section for standups, and a detailed Done list with the numbers. Months of them roll up into the dashboard — a record you can look back on.',
      ticks: [
        'Summary · Share · Done, every day',
        'Numbers preserved — counts, %, before→after',
        'Weekly & monthly rollups, automatic',
        'Customizable AI prompts — daily / weekly / monthly',
      ],
    },
    setup: {
      eyebrow: 'Setup',
      title: 'Connected in a few minutes',
      lead: 'cairn keeps everything on your machine — you connect your own tokens during onboarding.',
      notion: {
        title: 'Where worklogs publish',
        s1pre: 'Create an integration at ',
        s1link: 'notion.so/my-integrations',
        s1post: ' and copy the token (',
        s2: 'Share the parent page you want worklogs under with that integration.',
        s3: 'Paste the token — cairn finds the page and auto-creates the DB.',
      },
      github: {
        title: 'Where activity is collected',
        ghAuto:
          'Easiest: with the GitHub CLI (gh) installed and signed in, cairn imports the token automatically — no PAT needed.',
        s1pre: 'The ',
        s1link: 'classic-token link',
        s1post: ' prefills the recommended scopes.',
        s2pre: 'Or a fine-grained PAT with ',
        s2em: 'Pull requests · Contents · Metadata = Read',
        s3: 'Paste it in onboarding — it verifies automatically.',
      },
      claude: {
        title: 'The summarizer',
        s1pre: 'Install ',
        s1link: 'Claude Code',
        s1post: ' and log in — cairn inherits that auth, no extra cost.',
        s2: 'Or paste an Anthropic API key. Either works.',
      },
      notionVideo: 'Notion integration — 40-second walkthrough',
      gatekeeperPre: 'macOS note: ',
      gatekeeper:
        "the app isn't code-signed yet, so the first launch is blocked by Gatekeeper. Right-click the app → Open, or run ",
      gatekeeperPost: ' once.',
    },
    cta: { title: 'Start stacking your worklog', button: 'Download for macOS' },
    footer: { docs: 'Docs', privacy: 'Privacy Policy', terms: 'Terms of Service' },
  },
  ko: {
    nav: { how: '작동 방식', worklog: '일지', setup: '설정' },
    hero: {
      badge: '오픈소스 · 무료 · 내 컴퓨터에서 실행',
      h1a: '매일의 작업을,',
      h1b: '일지로 쌓아 올리다.',
      lead: '등산로의 돌탑처럼, 매일 작업 흔적을 하나씩 쌓습니다. cairn 은 GitHub PR·커밋을 모아 Claude 로 요약하고, 매일 Notion 일지로 발행합니다 — 나중에 돌아볼 작업 기록이 자동으로 쌓입니다.',
      download: 'macOS 다운로드',
      source: '소스 보기',
      sub: 'Apple Silicon · AGPL-3.0',
      unsigned: '미서명 앱이라 첫 실행 시 "손상됨"이 뜨면 실행:',
      copyCmd: '명령어 복사',
      expand: '크게 보기',
    },
    how: {
      eyebrow: '작동 방식',
      title: '수집 → 요약 → 발행',
      lead: '한 번 설정하면 세 단계가 모두 자동입니다.',
      steps: [
        {
          t: '수집',
          d: '그날 내가 작성·할당된 GitHub PR 과 로컬 Git 커밋을 — 여러 계정·레포에 걸쳐 모읍니다. 코드 본문은 절대 기기를 떠나지 않습니다.',
        },
        {
          t: '요약',
          d: 'Claude 가 원자료를 깔끔한 수치화 요약으로 — 무엇을 했고, 결과가 무엇이고, 수치가 얼마인지. 내 Claude 로그인으로 동작하며 추가 과금이 없습니다.',
        },
        {
          t: '발행',
          d: '날짜별 일지가 복붙용 Share 섹션과 함께 Notion 에 올라갑니다. 주간·월간 롤업도 자동 생성됩니다.',
        },
      ],
    },
    highlights: {
      eyebrow: '핵심',
      title: 'cairn 이 하는 일',
      lead: '한눈에 보는 주요 기능.',
      items: [
        {
          title: '수집',
          meta: 'GitHub + 로컬 Git',
          status: 'Core',
          description: '여러 계정·레포에 걸친 GitHub PR(작성·할당)과 로컬 Git 커밋을 모읍니다.',
          tags: ['GitHub', 'Local Git'],
        },
        {
          title: '요약',
          meta: 'Claude Agent SDK',
          status: 'AI',
          description: 'Claude 가 원하는 언어(한/영)와 선택한 모델로 일지를 작성합니다.',
          tags: ['Claude', 'KO/EN'],
        },
        {
          title: '발행',
          meta: '일간 · 주간 · 월간',
          status: 'Notion',
          description: 'Notion 에 일일 일지 발행 + 주간·월간 롤업 자동 생성.',
          tags: ['Notion', 'Rollups'],
        },
        {
          title: '데스크톱 앱',
          meta: 'macOS',
          status: 'App',
          description:
            '가이드 설정, 원클릭·예약 자동 발행, 인앱 Notion 뷰어, 통계 대시보드, 기기 간 동기화.',
          tags: ['Auto-publish', 'Dashboard'],
        },
        {
          title: '로컬 우선 · 프라이버시',
          meta: 'no code egress',
          status: 'Privacy',
          description:
            '시크릿은 기기에만, 서버 없음 — 코드 본문·diff 는 절대 외부로 나가지 않습니다.',
          tags: ['Local', 'Whitelist'],
        },
      ],
    },
    output: {
      eyebrow: '결과물',
      title: '스스로 읽히는 일지',
      lead: '매일 Notion 에 깔끔한 페이지로 — 프로젝트 단위 요약, 스탠드업에 바로 복붙하는 Share 섹션, 수치가 담긴 상세 Done 목록. 몇 달이 쌓이면 대시보드로, 돌아볼 기록으로 굴러갑니다.',
      ticks: [
        '매일 Summary · Share · Done',
        '수치 보존 — 건수, %, before→after',
        '주간·월간 롤업 자동 생성',
        '프롬프트 커스터마이징 — 일간 / 주간 / 월간',
      ],
    },
    setup: {
      eyebrow: '설정',
      title: '몇 분이면 연결 끝',
      lead: 'cairn 은 모든 걸 내 기기에 둡니다 — 온보딩에서 본인 토큰을 직접 연결합니다.',
      notion: {
        title: '일지를 발행할 곳',
        s1pre: '',
        s1link: 'notion.so/my-integrations',
        s1post: ' 에서 integration 을 만들고 토큰(',
        s2: '일지를 둘 부모 페이지를 그 integration 과 공유합니다.',
        s3: '토큰을 붙여넣으면 — cairn 이 페이지를 찾아 DB 를 자동 생성합니다.',
      },
      github: {
        title: '활동을 수집할 곳',
        ghAuto:
          '가장 쉬움: GitHub CLI(gh)가 설치·로그인돼 있으면 cairn 이 토큰을 자동으로 가져옵니다 — PAT 불필요.',
        s1pre: '',
        s1link: 'Classic 토큰 링크',
        s1post: '가 권장 scope 를 미리 채워줍니다.',
        s2pre: '또는 fine-grained PAT — ',
        s2em: 'Pull requests · Contents · Metadata = Read',
        s3: '온보딩에 붙여넣으면 자동으로 확인됩니다.',
      },
      claude: {
        title: '요약 엔진',
        s1pre: '',
        s1link: 'Claude Code',
        s1post: ' 를 설치·로그인하면 — cairn 이 그 인증을 인계받아 추가 과금 없이 동작합니다.',
        s2: '또는 Anthropic API key 를 붙여넣어도 됩니다. 둘 다 됩니다.',
      },
      notionVideo: 'Notion integration 연결 — 40초 영상 가이드',
      gatekeeperPre: 'macOS 참고: ',
      gatekeeper:
        '아직 코드 서명이 안 돼 있어 첫 실행은 Gatekeeper 에 막힙니다. 앱 우클릭 → 열기, 또는 아래를 한 번 실행하세요 ',
      gatekeeperPost: '.',
    },
    cta: { title: '오늘부터 일지를 쌓아보세요', button: 'macOS 다운로드' },
    footer: { docs: '문서', privacy: '개인정보 처리방침', terms: '서비스 약관' },
  },
} satisfies Record<Lang, unknown>;
