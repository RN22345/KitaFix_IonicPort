import { AbstractControl, ValidationErrors } from '@angular/forms';

export const NAME_MAX_LENGTH = 30;

// Letters and dots, words separated by a single space
const NAME_PATTERN = /^[\p{L}.]+(?: [\p{L}.]+)*$/u;

export function nameValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value.trim()) return null; // empty is handled by Validators.required

  const valid = NAME_PATTERN.test(value.trim()) && !/ {2,}/.test(value);
  return valid ? null : { name: true };
}

// Removes the characters that are not allowed while the user types
export function sanitizeName(value: string): string {
  return value
    .replace(/[^\p{L}. ]/gu, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ /, '')
    .slice(0, NAME_MAX_LENGTH);
}