import { AbstractControl, ValidationErrors } from '@angular/forms';
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

/**
 * At least one of the six issue flags must be picked (Module Plan v4, Team 2 required
 * feature 3). The control holds the picked IssueFlagKey list; unknown keys do not count.
 */
export function atLeastOneIssue(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  const picked = Array.isArray(value) ? value : [];
  const hasIssue = ISSUE_DEFINITIONS.some((issue) => picked.includes(issue.key));
  return hasIssue ? null : { noIssue: true };
}
