import type { IrParam } from '../ir/ir';

function mapType(type: string): string {
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

export function buildObjectSchema(params: IrParam[]) {
  return {
    type: 'object',
    properties: Object.fromEntries(
      params.map((param) => [
        param.name,
        {
          type: mapType(param.type)
        }
      ])
    ),
    required: params.filter((param) => param.required).map((param) => param.name),
    additionalProperties: false
  };
}
