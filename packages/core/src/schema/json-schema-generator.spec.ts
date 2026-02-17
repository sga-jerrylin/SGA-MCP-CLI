import { buildObjectSchema } from './json-schema-generator';

describe('buildObjectSchema', () => {
  it('marks only required params as required', () => {
    const schema = buildObjectSchema([
      { name: 'orderId', type: 'string', required: true },
      { name: 'limit', type: 'number', required: false }
    ]);

    expect(schema.type).toBe('object');
    expect(schema.properties.orderId).toEqual({ type: 'string' });
    expect(schema.properties.limit).toEqual({ type: 'number' });
    expect(schema.required).toEqual(['orderId']);
    expect(schema.additionalProperties).toBe(false);
  });
});
