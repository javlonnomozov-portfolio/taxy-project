/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    // Monorepo paketi — test'da dist emas, manbadan o'qiymiz (build kutmasdan).
    '^@tty/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
  },
  collectCoverageFrom: ['**/*.service.ts', '**/*.util.ts'],
};
