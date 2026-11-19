# 결정 기록 (ADR)

- 비자명한 결정(기술 선택·아키텍처·보안/비용/운영 정책·컨벤션)은 ADR 로 남김. 코드만 봐도 명확한 것은 X
- 위치: `docs/decisions/NNNN-kebab-case.md`, 번호는 직전 +1
- 머지된 ADR 은 삭제하지 않음. 뒤집히면 새 ADR 을 추가하고 이전 ADR 상태를 `superseded by NNNN` 으로 변경
- 흐름: proposed 로 생성 → 확정되면 accepted 로 바꿔 commit (`docs(decisions): add ADR NNNN-...`) → PR 본문 "Related" 에 번호 기재

## 템플릿

```markdown
# NNNN. <결정 제목>

- 상태: proposed / accepted / superseded by NNNN
- 작성일: YYYY-MM-DD

## 맥락
## 결정
## 대안
## 결과
```
