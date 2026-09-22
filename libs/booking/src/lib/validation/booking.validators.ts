import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ISSUE_DEFINITIONS } from '../models/repair.model';

/** Required after trim (so "   " does not pass). */
export function trimmedRequired(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { required: true };
  }
  return null;
}

/** Date must be today or later. Mirrors the repairs_booking_date_not_past CHECK. */
export function notPastDate(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(`${value}T00:00:00`);
  if (Number.isNaN(selected.getTime())) {
    return { invalidDate: true };
  }
  return selected < today ? { pastDate: true } : null;
}

/** Group validator: at least one of the six issue checkboxes must be ticked. */
export const atLeastOneIssue: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const hasIssue = ISSUE_DEFINITIONS.some((issue) => group.get(issue.key)?.value === true);
  return hasIssue ? null : { noIssue: true };
};
