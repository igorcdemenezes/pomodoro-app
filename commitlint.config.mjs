/**
 * Conventional Commits, narrowed to this repository.
 *
 * Scopes follow `<app>/<module>` inside the monorepo so a commit says where it
 * lands without opening the diff. Cross-cutting concerns use a bare scope.
 * Add new modules to `SCOPES` as they appear.
 */
const SCOPES = [
  // cross-cutting
  'repo',
  'db',
  'ci',
  'docs',
  'readme',
  'deps',
  // backend
  'api',
  'api/auth',
  'api/users',
  'api/projects',
  'api/tasks',
  'api/sessions',
  'api/stats',
  'api/common',
  // mobile
  'mobile',
  'mobile/auth',
  'mobile/dashboard',
  'mobile/projects',
  'mobile/tasks',
  'mobile/timer',
  'mobile/history',
  'mobile/stats',
  'mobile/profile',
  'mobile/offline',
  'mobile/ui',
];

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'build', 'ci', 'chore', 'revert'],
    ],
    'scope-enum': [2, 'always', SCOPES],
    'scope-empty': [2, 'never'],
    // lower-case first letter, but proper nouns inside the subject stay intact
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};
