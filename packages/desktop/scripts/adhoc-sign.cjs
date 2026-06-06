const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

// 미서명 배포: arm64 는 유효한 서명이 없으면 "손상됨" 으로 막힘.
// electron-builder 가 Developer ID 없으면 서명을 skip 하므로, 번들 전체를 ad-hoc 로 강제 재서명한다.
exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
