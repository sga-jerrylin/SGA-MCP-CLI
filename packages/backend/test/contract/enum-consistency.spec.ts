import { readFileSync } from 'node:fs';
import { extractOpenApiEnums, extractSqlEnums } from '../../../../scripts/extract-openapi-enums.ts';

const openapi = readFileSync('E:/mcp/packages/shared/api-contract.yaml', 'utf8');
const sql = readFileSync('E:/mcp/packages/backend/src/db/migrations/0001_init_from_contract.sql', 'utf8');

const apiEnums = extractOpenApiEnums(openapi);
const dbEnums = extractSqlEnums(sql);

function sameValues(a: string[], b: string[]) {
  return [...a].sort().join(',') === [...b].sort().join(',');
}

if (!sameValues(apiEnums.project_status, dbEnums.project_status)) {
  throw new Error('Project status enum mismatch');
}
if (!sameValues(apiEnums.run_status, dbEnums.run_status)) {
  throw new Error('GenerateRun status enum mismatch');
}
if (!sameValues(apiEnums.server_status, dbEnums.server_status)) {
  throw new Error('McpServer status enum mismatch');
}
if (!sameValues(apiEnums.tenant_status, dbEnums.tenant_status)) {
  throw new Error('Tenant status enum mismatch');
}
if (!sameValues(apiEnums.api_key_status, dbEnums.api_key_status)) {
  throw new Error('ApiKey status enum mismatch');
}
