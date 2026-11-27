import { AbstractControl, ValidationErrors } from '@angular/forms';

// Users must be at least this old
export const MIN_AGE = 13;

// Validator for the birthday field: error if the user is younger than MIN_AGE
export function minAgeValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null; // empty is handled by Validators.required

  const birthday = new Date(control.value);
  const today = new Date();

  let age = today.getFullYear() - birthday.getFullYear();

  // If the birthday hasn't happened yet this year, the user is one year younger
  const hadBirthdayThisYear =
    today.getMonth() > birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() && today.getDate() >= birthday.getDate());
  if (!hadBirthdayThisYear) age--;

  return age >= MIN_AGE ? null : { minAge: true };
}

// Today's date minus MIN_AGE years, written as YYYY-MM-DD for the date picker
export function getMaxBirthday(): string {
  const today = new Date();
  const year = today.getFullYear() - MIN_AGE;
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}