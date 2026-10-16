import { AbstractControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { atLeastOneIssue, notPastDate, trimmedRequired } from './booking.validators';

const control = (value: unknown) => ({ value }) as AbstractControl;

function localIsoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

describe('trimmedRequired', () => {
  it('blocks empty and whitespace-only text', () => {
    expect(trimmedRequired(control(''))).toEqual({ required: true });
    expect(trimmedRequired(control('   '))).toEqual({ required: true });
    expect(trimmedRequired(control(null))).toEqual({ required: true });
  });

  it('accepts real text', () => {
    expect(trimmedRequired(control(' Samsung '))).toBeNull();
  });
});

describe('notPastDate', () => {
  it('blocks yesterday', () => {
    expect(notPastDate(control(localIsoDate(-1)))).toEqual({ pastDate: true });
  });

  it('accepts today and tomorrow', () => {
    expect(notPastDate(control(localIsoDate(0)))).toBeNull();
    expect(notPastDate(control(localIsoDate(1)))).toBeNull();
  });

  it('leaves an empty value to Validators.required', () => {
    expect(notPastDate(control(''))).toBeNull();
  });

  it('flags a value that is not a date', () => {
    expect(notPastDate(control('not-a-date'))).toEqual({ invalidDate: true });
  });
});

describe('atLeastOneIssue', () => {
  it('blocks when no issue is picked', () => {
    expect(atLeastOneIssue(control([]))).toEqual({ noIssue: true });
    expect(atLeastOneIssue(control(null))).toEqual({ noIssue: true });
  });

  it('ignores unknown keys', () => {
    expect(atLeastOneIssue(control(['issue_toaster']))).toEqual({ noIssue: true });
  });

  it('accepts one or more of the six flags', () => {
    expect(atLeastOneIssue(control(['issue_battery']))).toBeNull();
    expect(atLeastOneIssue(control(['issue_screen', 'issue_software']))).toBeNull();
  });
});
