import { DiagnosticError } from './diagnostic-error';

describe('DiagnosticError', () => {
  it('stores structured diagnostics metadata', () => {
    const error = new DiagnosticError({
      code: 'MISSING_SYSTEM_CODE',
      section: 'System Info',
      hint: 'Add `- System Code:` in markdown'
    });

    expect(error.message).toBe('MISSING_SYSTEM_CODE');
    expect(error.meta.section).toBe('System Info');
    expect(error.meta.hint).toContain('System Code');
  });
});
