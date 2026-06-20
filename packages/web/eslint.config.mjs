import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const config = [
  { ignores: ['.next/**', 'next-env.d.ts', 'lib/auth-schema.ts'] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default config;
