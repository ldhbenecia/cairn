// packages/web 는 자체 ESLint(eslint-config-next, eslint 9)를 써서 루트 ESLint(10)로
// 린트하면 플러그인 버전 충돌로 깨진다. 루트 eslint 는 web 외 파일에만 적용하고,
// web 린트는 CI 의 `pnpm --filter @cairn/web lint` 가 강제한다.
const inWeb = (f) => f.includes('/packages/web/');

export default {
  '*.{ts,js,mjs,cjs}': (files) => {
    const lintable = files.filter((f) => !inWeb(f));
    const tasks = [];
    if (lintable.length > 0) tasks.push(`eslint --fix ${lintable.join(' ')}`);
    tasks.push(`prettier --write ${files.join(' ')}`);
    return tasks;
  },
  '*.{json,yml,yaml}': 'prettier --write',
};
