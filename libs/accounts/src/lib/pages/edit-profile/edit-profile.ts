import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { ProfileService } from '../../services/profile';
import { AccountsAuthService, authMessage } from '../../services/accounts-auth';
import { getMaxBirthday, MIN_AGE, minAgeValidator } from '../../validators/birthday';
import { NAME_MAX_LENGTH, nameValidator, sanitizeName } from '../../validators/name';
import { AccountIdPipe } from '../../pipes/account-id.pipe';

const CROP_BOX = 280; // size of the square crop box on the screen (px)

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.html',
  styleUrl: '../../styles/accounts.scss',
  standalone: true,
  imports: [IonContent, IonIcon, RouterLink, ReactiveFormsModule, AccountIdPipe,],
})
export class EditProfilePage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private readonly auth = inject(AccountsAuthService);

  get profile() { return this.profileService.profile; }
  photoPreview = signal(this.profile.profilePictureUrl ?? ''); // the picture shown (changes when the user picks a new one)
  selectedPhoto: File | null = null;
  readonly removePhoto = signal(false); // true when the user pressed "Remove photo"
  minAge = MIN_AGE;
  maxBirthday = getMaxBirthday();
  showConfirm = false; // shows the "Save changes?" box
  readonly saving = signal(false);
  readonly saveError = signal('');
  readonly nameSyncFailed = signal(false);

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

  ionViewWillEnter() {
    // Ionic can reuse this component: discard the previous entry's snapshot.
    this.form.reset({ firstName: this.profile.firstName, lastName: this.profile.lastName,
      contactNo: this.profile.contactNo, address: this.profile.address || '',
      birthday: this.profile.birthday, gender: this.profile.gender });
    this.photoPreview.set(this.profile.profilePictureUrl || '');
    this.selectedPhoto = null;
    this.removePhoto.set(false);
    this.closeCropper();
    this.showConfirm = false;
    this.saveError.set('');
    this.nameSyncFailed.set(false);
  }

  // The form starts with the saved values. The email is not in the form because it can't be edited
  form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(NAME_MAX_LENGTH), nameValidator]],
    lastName: ['', [Validators.required, Validators.maxLength(NAME_MAX_LENGTH), nameValidator]],
    contactNo: [this.profile.contactNo, [Validators.required, Validators.pattern(/^(\+63|0)9\d{9}$/)]],
    address: [this.profile.address ?? ''],
    birthday: [this.profile.birthday, [Validators.required, minAgeValidator]],
    gender: [this.profile.gender, Validators.required],
  });

  // True when a field has an error AND the user already touched it
  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  // Runs when the user picks a picture: checks it, then opens the crop box
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.saveError.set('Choose a JPG, PNG or WebP picture.');
      input.value = '';
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      this.saveError.set('The image must not exceed 12 MB.');
      input.value = '';
      return;
    }

    this.saveError.set('');
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
      this.saveError.set('The image could not be opened. Try another one.');
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

  // "Use photo": cuts the square part the user chose and keeps it as the new picture
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
      this.saveError.set('Cropping is not supported on this device.');
      return;
    }

    context.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 800, 800);

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/webp', 0.9);
    });

    if (!blob) {
      this.saveError.set('The picture could not be cropped. Try again.');
      return;
    }

    // Free the old preview if it was a picture picked earlier
    const oldPreview = this.photoPreview();
    if (oldPreview.startsWith('blob:')) URL.revokeObjectURL(oldPreview);

    this.selectedPhoto = new File([blob], 'avatar.webp', { type: 'image/webp' });
    this.removePhoto.set(false);
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

  // "Remove photo" button: the picture is really deleted when the user saves
  onRemovePhoto() {
    this.selectedPhoto = null;
    this.removePhoto.set(!!this.profile.profilePictureUrl); // only needed if a picture was saved before
    this.photoPreview.set('');
  }

  // "Save changes" button: checks the form, then asks the user to confirm
  submit() {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.showConfirm = true;
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

  // "Save" inside the confirm box: saves the changes and goes back to the Me page
  async confirmSave() {
    if (this.saving() || this.form.invalid) return;

    const userId = this.profile.id;
    this.saving.set(true);
    this.saveError.set('');

    try {
      // Save the personal information first.
      const synced = await this.auth.saveOwnProfile(
        userId,
        this.form.getRawValue()
      );

      if (this.selectedPhoto) {
        // Upload the new (cropped) profile picture.
        await this.auth.uploadProfilePicture(this.selectedPhoto);
        this.selectedPhoto = null;
      } else if (this.removePhoto()) {
        // The user removed the picture.
        await this.auth.removeProfilePicture();
        this.removePhoto.set(false);
      }

      this.showConfirm = false;

      if (synced === false) {
        this.nameSyncFailed.set(true);
        this.saveError.set(
          'Your profile and picture were saved, but the Auth display name could not be confirmed. Retry name sync to finish.'
        );
        return;
      }

      this.nameSyncFailed.set(false);

      if (!(await this.router.navigate(['/accounts-my-account']))) {
        this.saveError.set(
          'Profile saved, but the page could not be opened. Use Back to profile.'
        );
      }
    } catch (error) {
      console.error('Profile save failed:', error);
      this.saveError.set(authMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  async retryNameSync() {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      if (await this.auth.retryProfileNameSync(this.profile.id)) {
        this.nameSyncFailed.set(false);
        this.saveError.set('');
        await this.router.navigate(['/accounts-my-account']);
      } else this.saveError.set('Your profile is saved. Auth display-name sync is still unconfirmed. Please retry shortly.');
    } catch {
      this.saveError.set('Your profile is saved. Sign in again to retry Auth display-name sync.');
    } finally { this.saving.set(false); }
  }
}