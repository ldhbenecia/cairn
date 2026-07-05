export type Lang = 'en' | 'ko';

export const content = {
  en: {
    nav: { how: 'How it works', worklog: 'Worklog', setup: 'Setup' },
    hero: {
      badge: 'Open source · free · runs on your machine',
      h1a: 'Your daily work,',
      h1b: 'stacked into a worklog.',
      lead: 'Like a trail cairn, it stacks one mark of work each day. cairn collects your GitHub PRs and commits, summarizes them with Claude, and writes a daily worklog to a local Markdown journal — publish to Notion and more with integrations. Your work, documented automatically and ready to look back on.',
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
    setup: {
      eyebrow: 'Setup',
      title: 'Connected in a few minutes',
      lead: 'cairn keeps everything on your machine — you connect your own tokens during onboarding.',
      notion: {
        title: 'Publish to Notion (optional)',
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
          a: 'Your authored and assigned GitHub PRs plus local Git commits for the day, across multiple accounts and repos. Collection runs on your machine with your own tokens — there is no server in between.',
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
    footer: { docs: 'Docs', privacy: 'Privacy Policy', terms: 'Terms of Service' },
  },
  ko: {
    nav: { how: '작동 방식', worklog: '일지', setup: '설정' },
    hero: {
      badge: '오픈소스 · 무료 · 내 컴퓨터에서 실행',
      h1a: '매일의 작업을,',
      h1b: '일지로 쌓아 올리다.',
      lead: '등산로의 돌탑처럼, 매일 작업 흔적을 하나씩 쌓습니다. cairn 은 GitHub PR·커밋을 모아 Claude 로 요약하고, 매일 로컬 마크다운 일지로 기록합니다 — 연동을 켜면 Notion 에도 발행돼요. 나중에 돌아볼 작업 기록이 자동으로 쌓입니다.',
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
    setup: {
      eyebrow: '설정',
      title: '몇 분이면 연결 끝',
      lead: 'cairn 은 모든 걸 내 기기에 둡니다 — 온보딩에서 본인 토큰을 직접 연결합니다.',
      notion: {
        title: 'Notion 에도 발행 (선택)',
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
          a: '그날 내가 작성·할당된 GitHub PR 과 로컬 Git 커밋을 여러 계정·레포에 걸쳐 모읍니다. 수집은 본인 토큰으로 내 기기에서 실행됩니다 — 중간에 서버가 없습니다.',
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
    footer: { docs: '문서', privacy: '개인정보 처리방침', terms: '서비스 약관' },
  },
} satisfies Record<Lang, unknown>;
