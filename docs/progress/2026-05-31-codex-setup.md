# 2026-05-31 — codex-setup

> 진행 단계: **개발 환경 정비** (마무리)
> 상태: 완료

## 완료
- `main` 최신화 후 `chore/codex-setup` 브랜치에서 Codex 설정 작업 시작.
- Claude 작업 규칙을 참고해 Codex용 루트 지침 파일 `AGENTS.md` 추가.
- `CLAUDE.md`의 기본 행동 원칙을 Codex 루트 지침 상단에 반영.
- 공식 문서 기준에 맞춰 package-local `AGENTS.md` 구조로 core/desktop 지침 분리.
- `packages/desktop/AGENTS.md`에 Electron/React 클라이언트단 컨벤션 추가.
- `codex debug prompt-input`으로 `AGENTS.md`가 모델 입력에 포함되는 것 확인.
- `packages/desktop` 기준으로 루트 + package-local `AGENTS.md`가 함께 로드되는 것 확인.

## 진행 중
- 없음.

## 시행착오 / 결정
- Codex의 자연어 작업 지침은 루트/하위 디렉터리 `AGENTS.md`로 구성한다.
- Codex `rules/`는 자연어 프로젝트 룰이 아니라 샌드박스 밖 명령 실행 승인 정책용 `.rules` 파일이다.
- 레포에는 사용자별 Codex 인증/모델 설정을 두지 않고, 공유 가능한 작업 규칙만 둔다.

## 다음
- 필요 시 사용자별 실행 옵션은 `~/.codex/config.toml` 또는 Codex CLI 인자로 관리.
- 명령 승인 정책이 필요해지면 Codex 공식 `.rules` 형식을 별도로 검토.
