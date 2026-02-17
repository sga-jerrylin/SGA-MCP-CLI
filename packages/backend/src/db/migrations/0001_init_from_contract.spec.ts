import { readFileSync } from 'node:fs';

describe('0001_init_from_contract.sql', () => {
  const sql = readFileSync(
    'E:/mcp/packages/backend/src/db/migrations/0001_init_from_contract.sql',
    'utf8'
  );

  it('contains all required tables and enum constraints', () => {
    const requiredTables = [
      'CREATE TABLE users',
      'CREATE TABLE projects',
      'CREATE TABLE generate_runs',
      'CREATE TABLE artifacts',
      'CREATE TABLE mcp_servers',
      'CREATE TABLE packages',
      'CREATE TABLE tenants',
      'CREATE TABLE api_keys',
      'CREATE TABLE audit_logs'
    ];

    for (const token of requiredTables) {
      expect(sql).toContain(token);
    }

    const requiredEnums = [
      "status IN ('pending','parsing','generating','testing','fixing','done','failed')",
      "status IN ('queued','running','done','failed')",
      "status IN ('healthy','degraded','stopped','deploying')",
      "status IN ('active','disabled')",
      "status IN ('active','revoked','expired')"
    ];

    for (const token of requiredEnums) {
      expect(sql).toContain(token);
    }
  });
});
