"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractOpenApiEnums = extractOpenApiEnums;
exports.extractSqlEnums = extractSqlEnums;
function parseEnumValues(raw) {
    return raw
        .split(',')
        .map((v) => v.replace(/['"\s]/g, '').trim())
        .filter(Boolean);
}
function captureEnumBlock(source, pattern) {
    const match = source.match(pattern);
    if (!match?.[1]) {
        return [];
    }
    return parseEnumValues(match[1]);
}
function extractOpenApiEnums(openapiYaml) {
    return {
        project_status: captureEnumBlock(openapiYaml, /Project:[\s\S]*?status:[\s\S]*?enum:\s*\[([^\]]+)\]/),
        run_status: captureEnumBlock(openapiYaml, /GenerateRun:[\s\S]*?status:[\s\S]*?enum:\s*\[([^\]]+)\]/),
        server_status: captureEnumBlock(openapiYaml, /McpServer:[\s\S]*?status:[\s\S]*?enum:\s*\[([^\]]+)\]/),
        tenant_status: captureEnumBlock(openapiYaml, /Tenant:[\s\S]*?status:[\s\S]*?enum:\s*\[([^\]]+)\]/),
        api_key_status: captureEnumBlock(openapiYaml, /ApiKey:[\s\S]*?status:[\s\S]*?enum:\s*\[([^\]]+)\]/),
    };
}
function extractSqlEnums(sql) {
    return {
        project_status: captureEnumBlock(sql, /CREATE TABLE projects[\s\S]*?status TEXT NOT NULL CHECK \(status IN \(([^)]+)\)\)/),
        run_status: captureEnumBlock(sql, /CREATE TABLE generate_runs[\s\S]*?status TEXT NOT NULL CHECK \(status IN \(([^)]+)\)\)/),
        server_status: captureEnumBlock(sql, /CREATE TABLE mcp_servers[\s\S]*?status TEXT NOT NULL CHECK \(status IN \(([^)]+)\)\)/),
        tenant_status: captureEnumBlock(sql, /CREATE TABLE tenants[\s\S]*?status TEXT NOT NULL CHECK \(status IN \(([^)]+)\)\)/),
        api_key_status: captureEnumBlock(sql, /CREATE TABLE api_keys[\s\S]*?status TEXT NOT NULL CHECK \(status IN \(([^)]+)\)\)/),
    };
}
//# sourceMappingURL=extract-openapi-enums.js.map