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
    '^@mcp-claw/core$': '<rootDir>/../core/src/index.ts',
    '^@mcp-claw/core/(.*)$': '<rootDir>/../core/src/$1',
    '^@mcp-claw/shared$': '<rootDir>/../shared/src/index.ts',
    '^@mcp-claw/shared/(.*)$': '<rootDir>/../shared/$1'
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/**/index.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node'
};

export default config;
