import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '(src|test/integration)/.*\\.spec\\.ts$',
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
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/**/index.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node'
};

export default config;
