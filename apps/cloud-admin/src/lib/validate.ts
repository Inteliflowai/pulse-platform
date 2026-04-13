/**
 * Lightweight request validation. No external deps.
 * Returns null if valid, error string if invalid.
 */

type Rule = {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  enum?: string[];
  min?: number;
  max?: number;
};

export function validate(body: any, rules: Rule[]): string | null {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object';

  for (const rule of rules) {
    const value = body[rule.field];

    if (rule.required && (value === undefined || value === null || value === '')) {
      return `Missing required field: ${rule.field}`;
    }

    if (value === undefined || value === null) continue;

    if (rule.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rule.type) {
        return `Field "${rule.field}" must be of type ${rule.type}, got ${actualType}`;
      }
    }

    if (rule.enum && !rule.enum.includes(value)) {
      return `Field "${rule.field}" must be one of: ${rule.enum.join(', ')}`;
    }

    if (rule.type === 'string' && rule.min && value.length < rule.min) {
      return `Field "${rule.field}" must be at least ${rule.min} characters`;
    }

    if (rule.type === 'string' && rule.max && value.length > rule.max) {
      return `Field "${rule.field}" must be at most ${rule.max} characters`;
    }
  }

  return null;
}
