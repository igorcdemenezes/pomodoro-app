/**
 * A single suite covers unit and integration specs.
 *
 * `*.spec.ts` next to the source is a unit test with no I/O; `*.e2e-spec.ts`
 * under `test/` boots the Nest application against a real database. Integration
 * specs run serially in CI (`--runInBand`) because they share one database.
 */
/** @type {import('jest').Config} */
export default {
  rootDir: '.',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testTimeout: 20000,
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts'],
  coverageDirectory: 'coverage',
};
