import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// 시크릿 암호화 키를 macOS 로그인 키체인에 보관 (ADR 0037). safeStorage 대신 자체 키를 쓰는
// 이유: 키체인 항목은 앱 서명 정체성과 무관해 dev/packaged 가 같은 키를 공유하고, `-A`(모든 앱
// 허용) 항목이라 미서명·ad-hoc 앱에서도 프롬프트가 없다. 파일만 복사해 가면 키가 없어 못 읽는
// 구조는 동일하게 성립("계정 귀속"). 같은 유저로 실행되는 프로세스는 키를 읽을 수 있다 —
// safeStorage 도 동일한 한계라, 위협 모델(파일 유출)에선 차이가 없다.

const SERVICE = 'cairn secrets';
const ACCOUNT = 'cairn';
const KEY_HEX_RE = /^[0-9a-f]{64}$/;

function readKey(): Buffer | null {
  try {
    const hex = execFileSync(
      '/usr/bin/security',
      ['find-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 },
    ).trim();
    // 형식이 깨진 항목이면 덮어쓰지 않고 포기 — 기존 암호문을 고아로 만들 수 있다
    return KEY_HEX_RE.test(hex) ? Buffer.from(hex, 'hex') : null;
  } catch {
    return null; // 항목 없음(exit 44) 포함
  }
}

// 키 조회, 없으면 생성. 실패하면 null — 호출측이 평문 폴백(fail-open, 발행을 막지 않는다)
export function getOrCreateSecretKey(): Buffer | null {
  if (process.platform !== 'darwin') return null;
  const existing = readKey();
  if (existing) return existing;
  try {
    const key = randomBytes(32);
    // -A: 모든 앱 접근 허용(프롬프트 없음), -U: 있으면 갱신. 생성 시 1회 argv 로 키가 지나가는
    // 점은 수용(ps 순간 노출 — 로컬 동일 유저 한정이며 생성 때 한 번뿐)
    execFileSync(
      '/usr/bin/security',
      ['add-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w', key.toString('hex'), '-A', '-U'],
      { stdio: 'ignore' },
    );
    // 생성 직후 재조회로 확정 — 동시 생성 레이스면 키체인에 실제로 저장된 쪽을 쓴다
    return readKey() ?? key;
  } catch {
    return null;
  }
}
