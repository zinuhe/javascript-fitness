/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      ['auth', 'core', 'gateway', 'contracts', 'common', 'config', 'docker', 'ci', 'repo'],
    ],
  },
};
