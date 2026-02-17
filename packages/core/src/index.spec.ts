describe('core root exports', () => {
  it('exports required symbols', async () => {
    const mod = await import('./index');

    expect(mod).toHaveProperty('DiagnosticError');
    expect(mod).toHaveProperty('IrSchema');
    expect(mod).toHaveProperty('parseSystemInfo');
    expect(mod).toHaveProperty('McpClawCore');
  });
});
