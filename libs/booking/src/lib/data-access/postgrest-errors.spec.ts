import { PostgrestError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { mapPostgrestError } from './postgrest-errors';

const pgError = (code: string) =>
  ({ code, message: `raw ${code}`, details: '', hint: '' }) as unknown as PostgrestError;

describe('mapPostgrestError', () => {
  it('maps the double-booking constraint to SLOT_TAKEN', () => {
    expect(mapPostgrestError(pgError('23P01')).code).toBe('SLOT_TAKEN');
    expect(mapPostgrestError(pgError('23505')).code).toBe('SLOT_TAKEN');
  });

  it('maps the active-repairs limit to LIMIT_REACHED', () => {
    expect(mapPostgrestError(pgError('KF001')).code).toBe('LIMIT_REACHED');
  });

  it('maps RLS / guard failures to NOT_ALLOWED', () => {
    expect(mapPostgrestError(pgError('42501')).code).toBe('NOT_ALLOWED');
  });

  it('maps a missing column (migration not applied) to a friendly message', () => {
    const error = mapPostgrestError(pgError('PGRST204'));
    expect(error.message).not.toContain('raw');
    expect(error.message).toContain('database has not been updated');
  });

  it('never shows the raw text for known codes', () => {
    for (const code of ['23P01', '23505', '23503', '23514', '42501', 'PGRST116', 'PGRST204', 'KF001']) {
      expect(mapPostgrestError(pgError(code)).message).not.toContain(`raw ${code}`);
    }
  });
});
