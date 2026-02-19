import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json'
      }
    ]
  },
  moduleNameMapper: {
    '^@sga/core$': '<rootDir>/../core/src/index.ts',
    '^@sga/core/(.*)$': '<rootDir>/../core/src/$1',
    '^@sga/shared$': '<rootDir>/../shared/src/index.ts',
    '^@sga/shared/(.*)$': '<rootDir>/../shared/$1'
  },
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(chalk|ora|#ansi-styles|ansi-styles|#supports-color|supports-color|chalk-template|is-unicode-supported|log-symbols|cli-spinners|is-interactive|stdin-discarder)/)'
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/index.ts']
};

export default config;
