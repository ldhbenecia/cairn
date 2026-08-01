export type Lang = 'en' | 'ko';

export const content = {
  en: {
    nav: {
      how: 'How it works',
      worklog: 'Worklog',
      setup: 'Setup',
      pricing: 'Pricing',
      product: 'Product',
      faq: 'FAQ',
      menu: 'Menu',
      getStarted: 'Get Started',
      productItems: [
        { href: '#how', label: 'How it works', desc: 'Collect → Summarize → Publish' },
        { href: '#highlights', label: 'What you get', desc: 'Everything cairn does, at a glance' },
        { href: '/setup/notion', label: 'Setup guide', desc: 'Connect GitHub, Claude, and Notion' },
      ],
    },
    pricing: {
      eyebrow: 'Pricing',
      title: 'Free to stack. Pro when you need more.',
      lead: 'The core loop — collect, summarize, journal — is free and open source. Pro unlocks the power features, once.',
      footnote:
        'Pro is a one-time purchase with a license key — no subscription. You bring your own Claude account and tokens on every plan; cairn never meters your model usage.',
      back: 'Back to home',
      free: {
        name: 'Free',
        price: '$0',
        note: 'forever',
        features: [
          'GitHub (1 account) + local git collection',
          'Claude summaries, any model',
          'Local Markdown journal',
          'Notion publishing (1 workspace)',
          'Daily · weekly · monthly rollups',
          'Dashboard & graph view',
          'Backfill up to 7 days',
        ],
        cta: 'Download',
      },
      pro: {
        name: 'Pro',
        price: '$29',
        note: 'one-time',
        features: [
          'Everything in Free',
          'Custom prompts per period',
          'Multiple GitHub accounts',
          'Multiple Notion workspaces',
          'Unlimited backfill',
          'Yearly rollup + Wrapped',
          'Graph customization',
        ],
        cta: 'Buy Pro',
        ctaSoon: 'Checkout opening soon',
      },
      cloud: {
        name: 'Cloud',
        price: '—',
        note: 'coming later',
        features: ['End-to-end encrypted sync', 'Cloud backup', 'Long-term snapshot retention'],
        cta: 'Planned',
      },
    },
    hero: {
      badge: 'Open source · free · runs on your machine',
      h1a: 'Your daily work,',
      h1b: 'stacked into a worklog.',
      lead: 'cairn collects your GitHub PRs and commits, summarizes them with Claude, and writes a daily worklog to a local Markdown journal. Publish to Notion when you want — everything runs on your machine.',
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
          d: 'Your authored & assigned GitHub PRs and commits for the day — across multiple accounts and repos, with optional local Git. No code bodies ever leave your machine.',
        },
        {
          t: 'Summarize',
          d: 'Claude turns raw activity into a clean, quantified summary — what shipped, the outcome, the numbers. Runs on your own Claude login, no extra cost.',
        },
        {
          t: 'Publish',
          d: 'A dated worklog lands in your local Markdown journal with a copy-paste-ready Share section, plus automatic weekly and monthly rollups. Connect Notion and each publish creates a page there too.',
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
          meta: 'GitHub + optional local Git',
          status: 'Core',
          description:
            'GitHub PRs (authored + assigned) and commits across multiple repos and accounts, with local Git as an optional source.',
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
          status: 'Journal',
          description:
            'Daily logs in a local Markdown journal with automatic weekly and monthly rollups — connect Notion to publish there too.',
          tags: ['Markdown', 'Rollups'],
        },
        {
          title: 'Desktop app',
          meta: 'macOS',
          status: 'App',
          description:
            'Guided setup, one-click and scheduled auto-publish, an in-app worklog viewer, a stats dashboard, and cross-device sync.',
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
      lead: 'Each day lands in your journal as a clean Markdown page — a project-level summary, a copy-paste-ready Share section for standups, and a detailed Done list with the numbers. Months of them roll up into the dashboard — a record you can look back on.',
      ticks: [
        'Summary · Share · Done, every day',
        'Numbers preserved — counts, %, before→after',
        'Weekly & monthly rollups, automatic',
        'Customizable AI prompts — daily / weekly / monthly',
      ],
    },
    exports: {
      eyebrow: 'Export',
      title: 'Your worklog, everywhere',
      lead: "Local Markdown first — then send each day's log wherever it's useful.",
      items: [
        { t: 'Markdown journal', d: 'Every day lands as a plain .md file in a folder you own.' },
        {
          t: 'Notion publishing',
          d: 'Connect a workspace and each publish creates a Notion page too.',
        },
        {
          t: 'Obsidian mirror',
          d: 'Auto-mirrors your journal into any folder — Obsidian reads it as-is.',
        },
        {
          t: 'PDF & PNG export',
          d: 'Save a worklog as PDF, or your yearly report as a share-ready PNG card.',
        },
        {
          t: 'Standup snippet',
          d: "Yesterday's work as a paste-ready standup note — one click to copy.",
        },
        {
          t: 'Git backup',
          d: 'Your journal folder auto-commits and pushes to a remote repo you own.',
        },
      ],
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'Frequently asked questions',
      lead: 'The short answers — the source is open if you want the long ones.',
      items: [
        {
          q: 'Is it free?',
          a: 'Yes. cairn is open source (AGPL-3.0) and runs entirely on your machine — collecting, summarizing, and publishing are all free.',
        },
        {
          q: 'Does my code leave my machine?',
          a: 'No. Code bodies and diffs never leave your machine — this is enforced with a whitelist. Summaries only use metadata like PR titles and commit subjects.',
        },
        {
          q: 'What does it collect?',
          a: 'Your authored and assigned GitHub PRs and commits for the day, across multiple accounts and repos. Local Git collection is an optional source (off by default) for repos not on GitHub. Collection runs on your machine with your own tokens — there is no server in between.',
        },
        {
          q: 'Do I need a Claude subscription?',
          a: 'Summaries run on your own Claude account: install Claude Code and sign in (Pro/Max) and cairn inherits that auth, or paste an Anthropic API key. Either works.',
        },
        {
          q: 'Do I need Notion?',
          a: 'No. Worklogs are written to a local Markdown folder on your machine by default. Notion is one of several integrations — connect it and each publish also creates a Notion page. More integrations are on the way.',
        },
        {
          q: 'Where is my data stored?',
          a: 'Worklogs and stats live in local files on your machine — plain Markdown that opens in any editor. Tokens and secrets stay machine-local too; they are only sent to the services you configure.',
        },
      ],
    },
    cta: { title: 'Start stacking your worklog', button: 'Download for macOS' },
    footer: {
      docs: 'Docs',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      tagline: 'A local-first worklog for your daily dev work.',
      product: 'Product',
      resources: 'Resources',
      legal: 'Legal',
      download: 'Download',
      statusOk: 'All systems operational',
      statusFail: 'Status unavailable',
      claudeOk: 'Claude operational',
      claudeIssues: 'Claude issues',
      claudeUnknown: 'Claude status unavailable',
    },
  },
  ko: {
    nav: {
      how: '작동 방식',
      worklog: '일지',
      setup: '설정',
      pricing: '요금제',
      product: '제품',
      faq: 'FAQ',
      menu: '메뉴',
      getStarted: '시작하기',
      productItems: [
        { href: '#how', label: '작동 방식', desc: '수집 → 요약 → 발행' },
        { href: '#highlights', label: '주요 기능', desc: 'cairn 이 해주는 일 한눈에' },
        { href: '/ko/setup/notion', label: '설정 가이드', desc: 'GitHub·Claude·Notion 연결' },
      ],
    },
    pricing: {
      eyebrow: 'Pricing',
      title: '핵심은 무료, 더 필요할 때만 Pro.',
      lead: '수집 → 요약 → 일지 코어 루프는 무료 오픈소스입니다. Pro 는 파워 기능을 한 번의 결제로 엽니다.',
      footnote:
        'Pro 는 라이선스 키 방식의 일회성 구매입니다 — 구독 아님. 모든 플랜에서 Claude 계정·토큰은 본인 것을 쓰고, cairn 은 모델 사용량에 과금하지 않습니다.',
      back: '홈으로',
      free: {
        name: 'Free',
        price: '$0',
        note: '영원히',
        features: [
          'GitHub 1계정 + 로컬 git 수집',
          'Claude 요약 — 모델 자유 선택',
          '로컬 마크다운 일지',
          '노션 발행 (1워크스페이스)',
          '일간 · 주간 · 월간 롤업',
          '대시보드 · 그래프 뷰',
          '백필 7일',
        ],
        cta: '다운로드',
      },
      pro: {
        name: 'Pro',
        price: '$29',
        note: '일회성',
        features: [
          'Free 의 전부',
          '기간별 커스텀 프롬프트',
          '멀티 GitHub 계정',
          '멀티 노션 워크스페이스',
          '백필 무제한',
          '연간 롤업 + Wrapped',
          '그래프 커스터마이징',
        ],
        cta: 'Pro 구매',
        ctaSoon: '결제 준비 중',
      },
      cloud: {
        name: 'Cloud',
        price: '—',
        note: '나중에',
        features: ['E2E 암호화 동기화', '클라우드 백업', '스냅샷 장기 보존'],
        cta: '계획됨',
      },
    },
    hero: {
      badge: '오픈소스 · 무료 · 내 컴퓨터에서 실행',
      h1a: 'Your daily work,',
      h1b: 'stacked into a worklog.',
      lead: 'GitHub PR·커밋을 모아 Claude 로 요약하고, 매일 로컬 마크다운 일지로 기록합니다. 원할 때 Notion 으로 발행 — 전부 내 컴퓨터에서 돌아갑니다.',
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
          d: '그날 내가 작성·할당된 GitHub PR 과 커밋을 — 여러 계정·레포에 걸쳐 모읍니다. 로컬 Git 은 선택 소스. 코드 본문은 절대 기기를 떠나지 않습니다.',
        },
        {
          t: '요약',
          d: 'Claude 가 원자료를 깔끔한 수치화 요약으로 — 무엇을 했고, 결과가 무엇이고, 수치가 얼마인지. 내 Claude 로그인으로 동작하며 추가 과금이 없습니다.',
        },
        {
          t: '발행',
          d: '날짜별 일지가 복붙용 Share 섹션과 함께 로컬 마크다운 journal 에 기록되고, 주간·월간 롤업도 자동 생성됩니다. Notion 을 연동하면 발행 시 페이지도 함께 만들어집니다.',
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
          meta: 'GitHub + 로컬 Git(선택)',
          status: 'Core',
          description:
            '여러 계정·레포에 걸친 GitHub PR(작성·할당)과 커밋을 모읍니다. 로컬 Git 은 선택 소스.',
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
          status: 'Journal',
          description:
            '로컬 마크다운 journal 에 일일 일지 기록 + 주간·월간 롤업 자동 생성 — Notion 연동 시 페이지도 함께 발행.',
          tags: ['Markdown', 'Rollups'],
        },
        {
          title: '데스크톱 앱',
          meta: 'macOS',
          status: 'App',
          description:
            '가이드 설정, 원클릭·예약 자동 발행, 인앱 일지 뷰어, 통계 대시보드, 기기 간 동기화.',
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
      lead: '매일 깔끔한 마크다운 페이지로 — 프로젝트 단위 요약, 스탠드업에 바로 복붙하는 Share 섹션, 수치가 담긴 상세 Done 목록. 몇 달이 쌓이면 대시보드로, 돌아볼 기록으로 굴러갑니다.',
      ticks: [
        '매일 Summary · Share · Done',
        '수치 보존 — 건수, %, before→after',
        '주간·월간 롤업 자동 생성',
        '프롬프트 커스터마이징 — 일간 / 주간 / 월간',
      ],
    },
    exports: {
      eyebrow: '내보내기',
      title: '일지는 어디로든',
      lead: '로컬 마크다운이 먼저 남고 — 하루의 기록을 필요한 곳 어디로든 보냅니다.',
      items: [
        { t: '마크다운 일지', d: '매일이 내 폴더의 .md 파일로 남습니다.' },
        { t: 'Notion 발행', d: '워크스페이스를 연결하면 발행마다 노션 페이지도 생깁니다.' },
        { t: 'Obsidian 미러', d: '지정한 폴더로 저널을 자동 미러 — Obsidian 이 그대로 읽습니다.' },
        { t: 'PDF·PNG 내보내기', d: '일지는 PDF 로, 연간 리포트는 공유용 PNG 카드로 저장합니다.' },
        { t: '스탠드업 스니펫', d: '어제 한 일을 붙여넣기용 스탠드업 문구로, 클릭 한 번에 복사.' },
        { t: 'Git 백업', d: '일지 폴더를 내 원격 저장소로 자동 커밋·푸시합니다.' },
      ],
    },
    faq: {
      eyebrow: 'FAQ',
      title: '자주 묻는 질문',
      lead: '짧은 답만 모았습니다 — 긴 답이 궁금하면 소스가 열려 있습니다.',
      items: [
        {
          q: '무료인가요?',
          a: '네. cairn 은 오픈소스(AGPL-3.0)이고 전부 내 기기에서 실행됩니다 — 수집·요약·발행 모두 무료입니다.',
        },
        {
          q: '내 코드가 외부로 전송되나요?',
          a: '아니요. 코드 본문과 diff 는 절대 기기를 떠나지 않으며, 화이트리스트 방식으로 강제됩니다. 요약에는 PR 제목·커밋 제목 수준의 메타데이터만 사용합니다.',
        },
        {
          q: '어떤 걸 수집하나요?',
          a: '그날 내가 작성·할당된 GitHub PR 과 커밋을 여러 계정·레포에 걸쳐 모읍니다. 로컬 Git 수집은 GitHub 에 없는 레포용 선택 소스입니다(기본 꺼짐). 수집은 본인 토큰으로 내 기기에서 실행됩니다 — 중간에 서버가 없습니다.',
        },
        {
          q: 'Claude 구독이 필요한가요?',
          a: '요약은 본인의 Claude 계정으로 동작합니다: Claude Code 를 설치·로그인해 두면(Pro/Max) cairn 이 그 인증을 인계받고, 또는 Anthropic API 키를 붙여넣어도 됩니다. 둘 다 됩니다.',
        },
        {
          q: '노션 없이도 쓸 수 있나요?',
          a: '네. 일지는 기본적으로 내 기기의 로컬 폴더에 마크다운으로 기록됩니다. 노션은 여러 연동 중 하나라 연결하면 발행 시 노션 페이지도 함께 만들어지고, 연동은 계속 늘려갈 예정입니다.',
        },
        {
          q: '데이터는 어디에 저장되나요?',
          a: '일지와 통계 모두 기기의 로컬 파일에 쌓입니다 — 평문 마크다운이라 어떤 에디터로도 열 수 있어요. 토큰·시크릿도 전부 기기에만 저장되며, 내가 설정한 서비스로만 전송됩니다.',
        },
      ],
    },
    cta: { title: '오늘부터 일지를 쌓아보세요', button: 'macOS 다운로드' },
    footer: {
      docs: '문서',
      privacy: '개인정보 처리방침',
      terms: '서비스 약관',
      tagline: '매일의 개발 작업을 쌓는 로컬 우선 일지.',
      product: '제품',
      resources: '리소스',
      legal: '법적 고지',
      download: '다운로드',
      statusOk: '모든 시스템 가동중',
      statusFail: '상태 확인 불가',
      claudeOk: 'Claude 가동중',
      claudeIssues: 'Claude 이상 감지',
      claudeUnknown: 'Claude 상태 확인 불가',
    },
  },
} satisfies Record<Lang, unknown>;
