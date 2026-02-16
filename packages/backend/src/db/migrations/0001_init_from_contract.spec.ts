import { readFileSync } from 'node:fs';

const sql = readFileSync('E:/mcp/packages/backend/src/db/migrations/0001_init_from_contract.sql', 'utf8');
const requiredTables = [
  'CREATE TABLE users',
  'CREATE TABLE projects',
  'CREATE TABLE generate_runs',
  'CREATE TABLE artifacts',
  'CREATE TABLE mcp_servers',
  'CREATE TABLE packages',
  'CREATE TABLE tenants',
  'CREATE TABLE api_keys',
  'CREATE TABLE audit_logs',
];

for (const token of requiredTables) {
  if (!sql.includes(token)) {
    throw new Error(`missing table declaration: ${token}`);
  }
}

const requiredEnums = [
  "status IN ('pending','parsing','generating','testing','fixing','done','failed')",
  "status IN ('queued','running','done','failed')",
  "status IN ('healthy','degraded','stopped','deploying')",
  "status IN ('active','disabled')",
  "status IN ('active','revoked','expired')",
];

for (const token of requiredEnums) {
  if (!sql.includes(token)) {
    throw new Error(`missing enum constraint: ${token}`);
  }
}
