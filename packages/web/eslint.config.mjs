import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

const config = [
  { ignores: ['.next/**', 'next-env.d.ts', 'lib/auth-schema.ts'] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
];

export default config;
