// .eslintrc.cjs
module.exports = {
  root: true,
  ignorePatterns: ['dist/**', 'node_modules/**'],

  overrides: [
    // 1) TS 파일에만 typed linting 적용
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.eslint.json'],
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/recommended-type-checked',
        'plugin:@typescript-eslint/stylistic-type-checked',
      ],
      rules: {
        // 필요 시 여기서만 추가/조정
      },
    },

    // 2) JS/CJS는 type-aware(프로젝트 서비스)에서 분리
    {
      files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
      parser: 'espree',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script',
      },
    },
  ],
};
