import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonContent,
  IonDatetime,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { BOOKING_CONFIG } from '../../data-access/config';
import { BookingDraft } from '../../models/booking-draft.model';
import { BookingError, bookingErrorMessage } from '../../models/booking-error';
import { ISSUE_DEFINITIONS, normalizeTime, shortRepairId } from '../../models/repair.model';
import { PriceEstimate, estimatePrice, formatCurrency } from '../../pricing/price-estimate';
import { RepairsService } from '../../services/repairs.service';
import { atLeastOneIssue, notPastDate, trimmedRequired } from '../../validation/booking.validators';

/**
 * New Booking form (required feature 2 + validation feature 3).
 *
 * Fields: device brand, device model, location, date, time, service,
 * technician (optional), and the six issue checkboxes.
 *
 * Free slots only (recommended feature) - taken hours come from
 * public.get_taken_slots(), which never exposes other customers' rows.
 */
@Component({
  selector: 'app-new-booking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCheckbox,
    IonContent,
    IonDatetime,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonList,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './new-booking.page.html',
  styleUrl: './new-booking.page.scss',
})
export class NewBookingPage implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly booking = inject(RepairsService);
  private readonly config = inject(BOOKING_CONFIG);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);

  readonly issues = ISSUE_DEFINITIONS;
  readonly locations = this.config.locations;
  readonly services = this.booking.serviceOptions;
  readonly technicians = this.booking.technicianOptions;
  readonly currency = this.config.currency;

  readonly minDate = new Date().toISOString();
  readonly saving = signal(false);
  readonly submitAttempted = signal(false);
  readonly takenSlots = signal<string[]>([]);
  readonly loadingSlots = signal(false);
  readonly selectedDate = signal('');
  readonly estimate = signal<PriceEstimate>({ base: 0, issueFees: 0, total: 0 });

  readonly freeSlots = computed(() => {
    const taken = this.takenSlots().map((slot) => normalizeTime(slot));
    return this.config.slotTimes.filter((slot) => !taken.includes(slot));
  });

  readonly form = this.formBuilder.group(
    {
      device_brand: this.formBuilder.control('', [trimmedRequired]),
      device_model: this.formBuilder.control('', [trimmedRequired]),
      location: this.formBuilder.control(this.config.locations[0] ?? '', [trimmedRequired]),
      service_id: this.formBuilder.control('', [Validators.required]),
      technician_id: this.formBuilder.control(''),
      booking_date: this.formBuilder.control('', [Validators.required, notPastDate]),
      booking_time: this.formBuilder.control('', [Validators.required]),
      issue_screen: this.formBuilder.control(false),
      issue_battery: this.formBuilder.control(false),
      issue_charging: this.formBuilder.control(false),
      issue_camera: this.formBuilder.control(false),
      issue_audio: this.formBuilder.control(false),
      issue_software: this.formBuilder.control(false),
    },
    { validators: [atLeastOneIssue] },
  );

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.updateEstimate();
    });
    this.updateEstimate();
  }

  async ngOnInit(): Promise<void> {
    await this.booking.ensureLoaded();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);
    this.form.controls.booking_date.setValue(date);
    this.selectedDate.set(date);
    await this.loadSlots();
  }

  money(amount: number): string {
    return formatCurrency(amount, this.currency);
  }

  isInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitAttempted());
  }

  hasNoIssueError(): boolean {
    return this.form.hasError('noIssue') && this.submitAttempted();
  }

  onDateChange(event: Event): void {
    const value = (event as CustomEvent<{ value?: string | string[] | null }>).detail?.value;
    const date = Array.isArray(value) ? value[0] : value;
    if (!date) {
      return;
    }
    const isoDate = date.slice(0, 10);
    this.form.controls.booking_date.setValue(isoDate);
    this.form.controls.booking_time.setValue('');
    this.selectedDate.set(isoDate);
    void this.loadSlots();
  }

  onTimeChange(event: Event): void {
    const value = (event as CustomEvent<{ value?: string | string[] | null }>).detail?.value;
    const time = Array.isArray(value) ? value[0] : value;
    this.form.controls.booking_time.setValue(time ? normalizeTime(time) : '');
  }

  onLocationChange(): void {
    this.form.controls.booking_time.setValue('');
    void this.loadSlots();
  }

  async loadSlots(): Promise<void> {
    const date = this.form.controls.booking_date.value;
    const location = this.form.controls.location.value;
    if (!date || !location) {
      this.takenSlots.set([]);
      return;
    }

    this.loadingSlots.set(true);
    try {
      this.takenSlots.set(await this.booking.takenSlots(location, date));
      const chosen = normalizeTime(this.form.controls.booking_time.value);
      if (chosen && !this.freeSlots().includes(chosen)) {
        this.form.controls.booking_time.setValue('');
      }
    } catch (error) {
      await this.showToast(bookingErrorMessage(error), 'danger');
    } finally {
      this.loadingSlots.set(false);
    }
  }

  async submit(): Promise<void> {
    this.submitAttempted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.showToast('Please complete the highlighted fields.', 'warning');
      return;
    }

    this.saving.set(true);
    try {
      const repair = await this.booking.createBooking(this.buildDraft());
      await this.showToast(`Booking ${shortRepairId(repair.id)} created.`, 'success');
      this.resetForm();
      await this.router.navigateByUrl('/tabs/my-repairs');
    } catch (error) {
      await this.showToast(bookingErrorMessage(error), 'danger');
      if (error instanceof BookingError && error.code === 'SLOT_TAKEN') {
        await this.loadSlots();
      }
    } finally {
      this.saving.set(false);
    }
  }

  private buildDraft(): BookingDraft {
    const value = this.form.getRawValue();
    const issues = ISSUE_DEFINITIONS.filter((issue) => value[issue.key]).map(
      (issue) => issue.key,
    );
    return {
      service_id: value.service_id,
      technician_id: value.technician_id || null,
      device_brand: value.device_brand.trim(),
      device_model: value.device_model.trim(),
      location: value.location,
      booking_date: value.booking_date,
      booking_time: normalizeTime(value.booking_time),
      issues,
    };
  }

  private resetForm(): void {
    this.form.reset({
      device_brand: '',
      device_model: '',
      location: this.config.locations[0] ?? '',
      service_id: '',
      technician_id: '',
      booking_date: '',
      booking_time: '',
      issue_screen: false,
      issue_battery: false,
      issue_charging: false,
      issue_camera: false,
      issue_audio: false,
      issue_software: false,
    });
    this.submitAttempted.set(false);
  }

  private updateEstimate(): void {
    const serviceId = this.form.controls.service_id.value;
    const service = this.services().find((item) => item.id === serviceId) ?? null;
    const issues = ISSUE_DEFINITIONS.filter(
      (issue) => this.form.controls[issue.key].value,
    ).map((issue) => issue.key);
    this.estimate.set(estimatePrice(service, issues));
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toast.create({
      message,
      duration: 2800,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
