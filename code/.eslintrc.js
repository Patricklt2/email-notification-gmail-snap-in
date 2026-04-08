module.exports = {
  extends: [
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  ignorePatterns: ['**/dist/*', 'babel.config.js', 'jest.config.js', 'test/**'],
  overrides: [
    {
      files: ['**/*.test.ts'],
      rules: {
        // Test files load mocked modules after imports; disabling keeps Jest mock order stable.
        'simple-import-sort/imports': 'off',
      },
    },
    {
      files: ['test/**/*.ts'],
      rules: {
        '@typescript-eslint/naming-convention': 'off',
        '@typescript-eslint/no-use-before-define': 'off',
      },
    },
    {
      files: ['src/main.ts', 'src/test-runner/test-runner.ts'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
  },
  plugins: ['prettier', 'unused-imports', 'import', 'simple-import-sort', 'sort-keys-fix'],
  root: true,
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    'import/first': 'error',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
    'import/order': 'off',
    'no-unused-vars': 'off',
    'simple-import-sort/exports': 'error',
    'simple-import-sort/imports': 'error',
    'sort-imports': 'off',
    'sort-keys-fix/sort-keys-fix': ['error', 'asc', { natural: true }],
    'unused-imports/no-unused-imports': 'error',
  },
};
