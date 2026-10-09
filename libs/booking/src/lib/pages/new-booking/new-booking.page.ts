import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonDatetime,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { BOOKING_CONFIG } from '../../data-access/config';
import { BookingDraft } from '../../models/booking-draft.model';
import { BookingError, bookingErrorMessage } from '../../models/booking-error';
import {
  formatBookingDate,
  normalizeTime,
  shortRepairId,
  timeToMinutes,
} from '../../models/repair.model';
import { estimatePrice, formatCurrency } from '../../pricing/price-estimate';
import { RepairsService } from '../../services/repairs.service';
import { notPastDate, trimmedRequired } from '../../validation/booking.validators';

/** Local calendar date as YYYY-MM-DD (toISOString() would give the UTC date). */
function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function tomorrowIsoDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toLocalIsoDate(tomorrow);
}

/**
 * New Booking, as a 4-step flow that follows the KitaFix moodboard
 * ("Book Appointment"): Service -> Schedule -> Details -> Confirm.
 *
 * Same form, validators, slot lookup and RepairsService calls as before;
 * only the presentation is split into steps.
 */
@Component({
  selector: 'app-new-booking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IonButton,
      IonContent,
    IonDatetime,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTextarea,
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
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(IonContent) private content?: IonContent;

  readonly steps = ['Service', 'Schedule', 'Details', 'Confirm'] as const;
  readonly step = signal(0);
  readonly isLastStep = computed(() => this.step() === this.steps.length - 1);

  readonly locations = this.config.locations;
  readonly slotTimes = this.config.slotTimes;
  readonly services = this.booking.serviceOptions;
  readonly technicians = this.booking.technicianOptions;
  readonly currency = this.config.currency;

  readonly minDate = toLocalIsoDate(new Date());
  readonly saving = signal(false);
  /** True after a failed Next/Book press, so the current step shows its errors. */
  readonly showErrors = signal(false);
  readonly takenSlots = signal<string[]>([]);
  readonly loadingSlots = signal(false);
  readonly selectedDate = signal('');

  readonly form = this.formBuilder.group(
    {
      device_brand: this.formBuilder.control('', [trimmedRequired]),
      device_model: this.formBuilder.control('', [trimmedRequired]),
      location: this.formBuilder.control(this.config.locations[0] ?? '', [trimmedRequired]),
      service_id: this.formBuilder.control('', [Validators.required]),
      technician_id: this.formBuilder.control(''),
      booking_date: this.formBuilder.control('', [Validators.required, notPastDate]),
      booking_time: this.formBuilder.control('', [Validators.required]),
      issue_description: this.formBuilder.control('', [
        trimmedRequired,
        Validators.maxLength(500),
      ]),
    },
  );

  /** Signal mirror of the form value, so the template and computeds stay reactive. */
  readonly values = signal(this.form.getRawValue());

  private readonly takenSet = computed(
    () => new Set(this.takenSlots().map((slot) => normalizeTime(slot))),
  );
  readonly freeSlots = computed(() =>
    this.slotTimes.filter((slot) => !this.takenSet().has(slot) && !this.isPast(slot)),
  );

  readonly selectedService = computed(
    () => this.services().find((item) => item.id === this.values().service_id) ?? null,
  );
  readonly selectedTechnicianName = computed(
    () =>
      this.technicians().find((item) => item.id === this.values().technician_id)?.full_name ??
      'Any available technician',
  );
  readonly estimate = computed(() => estimatePrice(this.selectedService(), []));

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.values.set(this.form.getRawValue());
    });
    // "Book again" on My Repairs passes the old device/service/place as query params.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      void this.prefill(params.get('brand'), params.get('model'), params.get('service'), params.get('location'));
    });
  }

  async ngOnInit(): Promise<void> {
    await this.booking.ensureLoaded();
    this.applyDefaultDate();
    await this.loadSlots();
  }

  private async prefill(
    brand: string | null,
    model: string | null,
    serviceId: string | null,
    location: string | null,
  ): Promise<void> {
    if (!brand && !model && !serviceId && !location) {
      return;
    }
    await this.booking.ensureLoaded();
    const controls = this.form.controls;
    if (brand) controls.device_brand.setValue(brand);
    if (model) controls.device_model.setValue(model);
    if (location && this.locations.includes(location)) {
      controls.location.setValue(location);
    }
    if (serviceId && this.services().some((item) => item.id === serviceId)) {
      controls.service_id.setValue(serviceId);
      this.setStep(1);
    }
    await this.loadSlots();
  }

  // ---------- view helpers ----------

  money(amount: number): string {
    return formatCurrency(amount, this.currency);
  }

  prettyDate(): string {
    const date = this.values().booking_date;
    return date ? formatBookingDate(date) : '';
  }

  isTaken(slot: string): boolean {
    return this.takenSet().has(slot);
  }

  /** Today's hours that have already started cannot be booked. */
  isPast(slot: string): boolean {
    if (this.values().booking_date !== toLocalIsoDate(new Date())) {
      return false;
    }
    const now = new Date();
    return timeToMinutes(slot) <= now.getHours() * 60 + now.getMinutes();
  }

  isUnavailable(slot: string): boolean {
    return this.isTaken(slot) || this.isPast(slot);
  }

  /** Picks an icon from the service name; falls back to a wrench. */
  serviceIcon(name: string): string {
    const text = name.toLowerCase();
    if (text.includes('screen') || text.includes('display')) return 'phone-portrait-outline';
    if (text.includes('battery')) return 'battery-half-outline';
    if (text.includes('water') || text.includes('liquid')) return 'water-outline';
    return 'construct-outline';
  }

  isInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.showErrors());
  }

  // ---------- step navigation ----------

  back(): void {
    if (this.step() === 0) {
      void this.router.navigateByUrl('/tabs/dashboard');
      return;
    }
    this.setStep(this.step() - 1);
  }

  /** Discards the draft and returns to the dashboard. */
  cancel(): void {
    this.resetForm();
    void this.router.navigateByUrl('/tabs/dashboard');
    void this.loadSlots();
  }

  /** Stepper dots: only completed steps can be revisited. */
  jumpBack(index: number): void {
    if (index < this.step()) {
      this.setStep(index);
    }
  }

  async next(): Promise<void> {
    if (this.isLastStep()) {
      await this.submit();
      return;
    }
    if (!this.stepIsValid(this.step())) {
      this.touchStep(this.step());
      this.showErrors.set(true);
      return;
    }
    this.setStep(this.step() + 1);
  }

  private setStep(index: number): void {
    this.step.set(index);
    this.showErrors.set(false);
    void this.content?.scrollToTop(0);
  }

  private stepIsValid(step: number): boolean {
    const c = this.form.controls;
    switch (step) {
      case 0:
        return c.service_id.valid;
      case 1:
        return c.location.valid && c.booking_date.valid && c.booking_time.valid;
      case 2:
        return c.device_brand.valid && c.device_model.valid && c.issue_description.valid;
      default:
        return this.form.valid;
    }
  }

  private touchStep(step: number): void {
    const c = this.form.controls;
    const controls =
      step === 0
        ? [c.service_id]
        : step === 1
          ? [c.location, c.booking_date, c.booking_time]
          : step === 2
            ? [c.device_brand, c.device_model, c.issue_description]
            : [];
    controls.forEach((control) => control.markAsTouched());
  }

  // ---------- step 1: service ----------

  pickService(serviceId: string): void {
    this.form.controls.service_id.setValue(serviceId);
    this.form.controls.service_id.markAsTouched();
  }

  // ---------- step 2: schedule ----------

  pickLocation(location: string): void {
    this.form.controls.location.setValue(location);
    this.form.controls.booking_time.setValue('');
    void this.loadSlots();
  }

  pickSlot(slot: string): void {
    if (this.isUnavailable(slot)) {
      return;
    }
    this.form.controls.booking_time.setValue(normalizeTime(slot));
    this.form.controls.booking_time.markAsTouched();
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

  // ---------- step 4: confirm ----------

  async submit(): Promise<void> {
    const badStep = [0, 1, 2].find((index) => !this.stepIsValid(index));
    if (badStep !== undefined) {
      this.touchStep(badStep);
      this.setStep(badStep);
      this.showErrors.set(true);
      await this.showToast('Please complete the highlighted fields.', 'warning');
      return;
    }

    this.saving.set(true);
    try {
      const repair = await this.booking.createBooking(this.buildDraft());
      await this.showToast(`Booking ${shortRepairId(repair.id)} created.`, 'success');
      this.resetForm();
      await this.router.navigateByUrl('/tabs/my-repairs');
      void this.loadSlots();
    } catch (error) {
      await this.showToast(bookingErrorMessage(error), 'danger');
      if (error instanceof BookingError && error.code === 'SLOT_TAKEN') {
        this.form.controls.booking_time.setValue('');
        this.setStep(1);
        await this.loadSlots();
      }
    } finally {
      this.saving.set(false);
    }
  }

  private applyDefaultDate(): void {
    const date = tomorrowIsoDate();
    this.form.controls.booking_date.setValue(date);
    this.selectedDate.set(date);
  }

  private buildDraft(): BookingDraft {
    const value = this.form.getRawValue();
    return {
      service_id: value.service_id,
      technician_id: value.technician_id || null,
      device_brand: value.device_brand.trim(),
      device_model: value.device_model.trim(),
      location: value.location,
      booking_date: value.booking_date,
      booking_time: normalizeTime(value.booking_time),
      issues: [],
      issue_description: value.issue_description.trim(),
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
      issue_description: '',
    });
    this.applyDefaultDate();
    this.step.set(0);
    this.showErrors.set(false);
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