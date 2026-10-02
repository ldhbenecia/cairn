import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// 시크릿 암호화 키를 macOS 로그인 키체인에 보관 — 앱 서명과 무관해 dev·packaged 가 키를 공유하고
// `-A` 항목이라 미서명 앱에서도 프롬프트 없음, 파일만 복사해 가면 키가 없어 못 읽음

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
    // 형식이 깨진 항목이면 덮어쓰지 않고 포기 — 기존 암호문을 고아로 만들 수 있음
    return KEY_HEX_RE.test(hex) ? Buffer.from(hex, 'hex') : null;
  } catch {
    return null; // 항목 없음(exit 44) 포함
  }
}

// 키 조회, 없으면 생성 — 실패하면 null 로 호출측이 평문 폴백 (발행을 막지 않음)
export function getOrCreateSecretKey(): Buffer | null {
  if (process.platform !== 'darwin') return null;
  const existing = readKey();
  if (existing) return existing;
  try {
    const key = randomBytes(32);
    // -A: 모든 앱 접근 허용(프롬프트 없음), -U: 있으면 갱신
    // 키를 argv 로 넘기면 ps 에 순간 노출 — `security -i`(stdin 커맨드 모드)로 전달
    execFileSync('/usr/bin/security', ['-i'], {
      input: `add-generic-password -s "${SERVICE}" -a "${ACCOUNT}" -w ${key.toString('hex')} -A -U\n`,
      stdio: ['pipe', 'ignore', 'ignore'],
      timeout: 5000,
    });
    // 생성 직후 재조회로 확정 — 동시 생성 레이스면 키체인에 실제 저장된 쪽 사용
    return readKey() ?? key;
  } catch {
    return null;
  }
}
