const REDACTED = '[REDACTED]';

const PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // Authorization: Bearer <token>
  {
    regex: /Authorization:\s*Bearer\s+[^\s]+/gi,
    replacement: `Authorization: Bearer ${REDACTED}`
  },
  // Authorization: Basic <token>
  {
    regex: /Authorization:\s*Basic\s+[^\s]+/gi,
    replacement: `Authorization: Basic ${REDACTED}`
  },
  // api_key=..., api-key=..., apikey:...
  {
    regex: /(api[_-]?key\s*[:=]\s*)[^\s"'&]+/gi,
    replacement: `$1${REDACTED}`
  },
  // secret_key=..., secret-key=...
  {
    regex: /(secret[_-]?key\s*[:=]\s*)[^\s"'&]+/gi,
    replacement: `$1${REDACTED}`
  },
  // password=...
  {
    regex: /(password\s*[:=]\s*)[^\s"'&]+/gi,
    replacement: `$1${REDACTED}`
  },
  // token=...
  {
    regex: /(token\s*[:=]\s*)[^\s"'&]+/gi,
    replacement: `$1${REDACTED}`
  },
  // Common secret patterns: sk-..., sk_live_..., sk_test_...
  {
    regex: /\bsk[-_](live|test|prod)?[-_]?[a-zA-Z0-9]{20,}\b/g,
    replacement: REDACTED
  }
];

/**
 * Redact common secret patterns from a string.
 * Useful for sanitizing log output and audit trails.
 */
export function redactSecrets(input: string): string {
  let result = input;
  for (const { regex, replacement } of PATTERNS) {
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Redact secrets from an object's string values (shallow).
 */
export function redactObjectSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = redactSecrets(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
