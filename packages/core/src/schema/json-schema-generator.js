"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildObjectSchema = buildObjectSchema;
function mapType(type) {
    switch (type.toLowerCase()) {
        case 'int':
        case 'float':
        case 'double':
        case 'number':
            return 'number';
        case 'bool':
        case 'boolean':
            return 'boolean';
        case 'array':
            return 'array';
        case 'object':
            return 'object';
        default:
            return 'string';
    }
}
function buildObjectSchema(params) {
    return {
        type: 'object',
        properties: Object.fromEntries(params.map((param) => [
            param.name,
            {
                type: mapType(param.type)
            }
        ])),
        required: params.filter((param) => param.required).map((param) => param.name),
        additionalProperties: false
    };
}
//# sourceMappingURL=json-schema-generator.js.map