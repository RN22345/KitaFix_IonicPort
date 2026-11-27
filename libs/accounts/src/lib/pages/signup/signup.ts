import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { AccountsAuthService, accountLoginDestination, authMessage } from '../../services/accounts-auth';
import { getPasswordRules, passwordPolicy, passwordsMatch } from '../../validators/password';
import { NAME_MAX_LENGTH, nameValidator, sanitizeName } from '../../validators/name';

// Change this every time the Terms and Privacy Notice text changes
const TERMS_VERSION = '2026-11-03';

// Users must be at least this old to sign up
const MIN_AGE = 13;

// Profile picture rules (the storage bucket allows the same types and size)
const PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PICTURE_SIZE = 12 * 1024 * 1024; // 12 MB

const CROP_BOX = 280; // size of the square crop box on the screen (px)

// Validator for the birthday field: error if the user is younger than MIN_AGE
function minAgeValidator(control: AbstractControl): ValidationErrors | null {
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

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrl: './signup.page.scss',
  standalone: true,
  imports: [IonContent, IonIcon, RouterLink, ReactiveFormsModule],
})
export class SignupPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  private auth = inject(AccountsAuthService);
  busy = signal(false);
  submitted = false;
  error = signal('');

  minAge = MIN_AGE;
  maxBirthday = this.getMaxBirthday(); // latest date the birthday picker allows
  showPassword = false;
  photoFile: File | null = null; // the picture the user chose (saved after the email is verified)
  photoPreview = signal(''); // the same picture, shown on screen (empty = none)
  photoError = signal(''); // shown when the chosen file is not allowed
  showTerms = signal(false); // shows the "Terms and Privacy Notice" box

  // ----- Crop box -----
  cropBox = CROP_BOX;
  readonly cropSrc = signal(''); // the picture being cropped ('' = crop box is closed)
  readonly naturalW = signal(0); // real width of the picture
  readonly naturalH = signal(0); // real height of the picture
  readonly zoom = signal(1); // 1 = smallest size that still fills the box
  readonly offsetX = signal(0); // where the picture starts inside the box
  readonly offsetY = signal(0);
  private cropImage: HTMLImageElement | null = null;
  private dragStart: { px: number; py: number; ox: number; oy: number } | null = null;

  // Size that makes the shorter side of the picture fit the box
  readonly baseScale = computed(() => {
    const shortSide = Math.min(this.naturalW(), this.naturalH());
    return shortSide ? CROP_BOX / shortSide : 1;
  });
  readonly scale = computed(() => this.baseScale() * this.zoom());

  // The signup form. Every field is required except the profile picture
  form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(NAME_MAX_LENGTH), nameValidator]],
      lastName: ['', [Validators.required, Validators.maxLength(NAME_MAX_LENGTH), nameValidator]],
      email: ['', [Validators.required, Validators.email]],
      contactNo: ['', [Validators.required, Validators.pattern(/^(\+63|0)9\d{9}$/)]], // PH mobile number
      address: ['', Validators.required],
      birthday: ['', [Validators.required, minAgeValidator]],
      gender: ['', Validators.required],
      password: ['', [Validators.required, passwordPolicy]],
      confirmPassword: ['', Validators.required],
      agree: [false, Validators.requiredTrue],
    },
    { validators: passwordsMatch },
  );

  // The password checklist (8+ characters, 1 uppercase, 1 special character)
  get passwordRules() {
    return getPasswordRules(this.form.controls.password.value);
  }

  // True when the two passwords are different and the user already touched "confirm"
  get passwordsDontMatch(): boolean {
    return this.form.hasError('mismatch') && this.form.controls.confirmPassword.touched;
  }

  // True when a field has an error AND the user already touched it
  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  // Today's date minus MIN_AGE years, written as YYYY-MM-DD for the date picker
  private getMaxBirthday(): string {
    const today = new Date();
    const year = today.getFullYear() - MIN_AGE;
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Runs when the user picks a profile picture: checks it, then opens the crop box
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.photoError.set('');
    if (!file) return;

    if (!PICTURE_TYPES.includes(file.type)) {
      this.photoError.set('Choose a JPG, PNG or WebP picture.');
      input.value = ''; // forget the wrong file
      return;
    }
    if (file.size > MAX_PICTURE_SIZE) {
      this.photoError.set('The picture must be 12 MB or smaller.');
      input.value = '';
      return;
    }

    this.openCropper(file);
    input.value = ''; // so the same file can be picked again
  }

  // Opens the crop box with the picked picture
  private openCropper(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      this.cropImage = img;
      this.naturalW.set(img.naturalWidth);
      this.naturalH.set(img.naturalHeight);
      this.zoom.set(1);

      // Start with the picture in the middle of the box
      const scale = CROP_BOX / Math.min(img.naturalWidth, img.naturalHeight);
      this.offsetX.set((CROP_BOX - img.naturalWidth * scale) / 2);
      this.offsetY.set((CROP_BOX - img.naturalHeight * scale) / 2);

      this.cropSrc.set(url); // this shows the crop box
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      this.photoError.set('The image could not be opened. Try another one.');
    };

    img.src = url;
  }

  // Keeps the picture covering the whole box (no empty space)
  private moveImage(x: number, y: number) {
    const minX = CROP_BOX - this.naturalW() * this.scale();
    const minY = CROP_BOX - this.naturalH() * this.scale();
    this.offsetX.set(Math.min(0, Math.max(minX, x)));
    this.offsetY.set(Math.min(0, Math.max(minY, y)));
  }

  // Dragging the picture inside the crop box
  onCropPointerDown(event: PointerEvent) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragStart = {
      px: event.clientX,
      py: event.clientY,
      ox: this.offsetX(),
      oy: this.offsetY(),
    };
  }

  onCropPointerMove(event: PointerEvent) {
    if (!this.dragStart) return;
    this.moveImage(
      this.dragStart.ox + (event.clientX - this.dragStart.px),
      this.dragStart.oy + (event.clientY - this.dragStart.py)
    );
  }

  onCropPointerUp() {
    this.dragStart = null;
  }

  // Zoom slider: zoom in/out around the middle of the box
  onZoomChange(event: Event) {
    const newZoom = Number((event.target as HTMLInputElement).value);

    // The point of the picture that is in the middle of the box right now
    const centerX = (CROP_BOX / 2 - this.offsetX()) / this.scale();
    const centerY = (CROP_BOX / 2 - this.offsetY()) / this.scale();

    this.zoom.set(newZoom);

    // Keep that same point in the middle after zooming
    this.moveImage(
      CROP_BOX / 2 - centerX * this.scale(),
      CROP_BOX / 2 - centerY * this.scale()
    );
  }

    // Runs while the user types in a name field: removes characters that are not allowed
  cleanName(event: Event, field: 'firstName' | 'lastName') {
    const input = event.target as HTMLInputElement;
    const cleaned = sanitizeName(input.value);
    if (cleaned !== input.value) input.value = cleaned;
    this.form.controls[field].setValue(cleaned);
  }

  nameError(field: 'firstName' | 'lastName'): string {
    return this.form.controls[field].hasError('required')
      ? 'Required.'
      : 'Use letters, dots and single spaces only.';
  }

  // "Use photo": cuts the square part the user chose and keeps it as the picture
  async applyCrop() {
    const img = this.cropImage;
    if (!img) return;

    const scale = this.scale();
    const sourceX = -this.offsetX() / scale;
    const sourceY = -this.offsetY() / scale;
    const sourceSize = CROP_BOX / scale;

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;

    const context = canvas.getContext('2d');
    if (!context) {
      this.photoError.set('Cropping is not supported on this device.');
      return;
    }

    context.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 800, 800);

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/webp', 0.9);
    });

    if (!blob) {
      this.photoError.set('The picture could not be cropped. Try again.');
      return;
    }

    // Free the old preview if it was a picture picked earlier
    const oldPreview = this.photoPreview();
    if (oldPreview.startsWith('blob:')) URL.revokeObjectURL(oldPreview);

    this.photoFile = new File([blob], 'avatar.webp', { type: 'image/webp' });
    this.photoPreview.set(URL.createObjectURL(blob));
    this.closeCropper();
  }

  closeCropper() {
    const url = this.cropSrc();
    if (url) URL.revokeObjectURL(url);
    this.cropSrc.set('');
    this.cropImage = null;
    this.dragStart = null;
  }

  // "Remove photo" button: forgets the picture the user chose
  removePhoto() {
    const preview = this.photoPreview();
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);

    this.photoFile = null;
    this.photoPreview.set('');
    this.photoError.set('');
  }

  openTerms() {
    this.showTerms.set(true);
  }

  // "I agree" inside the terms box: ticks the checkbox and closes the box
  acceptTerms() {
    this.form.controls.agree.setValue(true);
    this.form.controls.agree.markAsTouched();
    this.showTerms.set(false);
  }

  // Runs when the form is submitted
  async submit() {
    if (this.busy() || this.submitted) return;
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched(); // show the errors on every invalid field
      return;
    }
    this.busy.set(true);
    const input = this.form.getRawValue();
    try {
      // The picture is passed along, and saved once the user has a session (after the code is verified)
      const hasSession = await this.auth.register(input, this.photoFile, TERMS_VERSION);
      this.submitted = true;
      this.form.controls.password.reset('');
      this.form.controls.confirmPassword.reset('');
      if (hasSession) {
        // Email confirmation is off: the signup already created a session. Remove it so the user logs in themselves.
        await this.auth.logout();
        await this.router.navigate(['/accounts-login'], {
          replaceUrl: true,
          state: { accountCreated: true },
        });
      } else {
        await this.router.navigate(['/accounts-verify-email'], {
          state: {
            email: input.email.trim(),
            purpose: 'signup',
            sentAt: Date.now(),
          },
          replaceUrl: true,
        });
      }
    } catch (error) {
      this.error.set(this.submitted
        ? 'Registration was accepted, but your account could not be opened. Return to Log in; do not register again.'
        : authMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}