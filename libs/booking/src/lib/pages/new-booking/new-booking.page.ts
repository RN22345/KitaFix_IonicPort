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
import { DeviceCatalogService } from '../../data-access/device-catalog/device-catalog.service';
import {
  DeviceSuggestion,
  findBrand,
  searchBrands,
  searchDevices,
  searchModels,
} from '../../data-access/device-catalog/device-search';
import { BookingDraft } from '../../models/booking-draft.model';
import { BookingError, bookingErrorMessage } from '../../models/booking-error';
import {
  ISSUE_DEFINITIONS,
  IssueFlagKey,
  PastDevice,
  formatBookingDate,
  normalizeTime,
  shortRepairId,
  timeToMinutes,
} from '../../models/repair.model';
import { estimatePrice, formatCurrency } from '../../pricing/price-estimate';
import { suggestService } from '../../pricing/service-match';
import { RepairsService } from '../../services/repairs.service';
import {
  atLeastOneIssue,
  notPastDate,
  trimmedRequired,
} from '../../validation/booking.validators';

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

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * New Booking in 3 steps: Device (what and what's wrong) -> Schedule (branch,
 * date, time) -> Review (service picked from the issues, optional technician,
 * estimate). The service is suggested instead of asked up front, because the
 * issue options already say the same thing.
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
  private readonly deviceCatalog = inject(DeviceCatalogService);
  private readonly config = inject(BOOKING_CONFIG);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(IonContent) private content?: IonContent;

  readonly steps = ['Device', 'Schedule', 'Review'] as const;
  readonly step = signal(0);
  readonly isLastStep = computed(() => this.step() === this.steps.length - 1);

  readonly locations = this.config.locations;
  readonly slotTimes = this.config.slotTimes;
  readonly services = this.booking.serviceOptions;
  readonly technicians = this.booking.technicianOptions;
  readonly myDevices = this.booking.myDevices;
  readonly currency = this.config.currency;
  readonly issueOptions = ISSUE_DEFINITIONS;

  readonly minDate = toLocalIsoDate(new Date());
  readonly saving = signal(false);
  /** True after a failed Next/Book press, so the current step shows its errors. */
  readonly showErrors = signal(false);
  readonly takenSlots = signal<string[]>([]);
  readonly loadingSlots = signal(false);
  readonly selectedDate = signal('');

  /** Which device field shows its suggestion list. */
  readonly activeField = signal<'brand' | 'model' | null>(null);
  private readonly brandQuery = signal('');
  private readonly modelQuery = signal('');
  /** Once the customer picks a service themselves, issues no longer change it. */
  private readonly serviceChosenByUser = signal(false);

  readonly form = this.formBuilder.group({
    device_brand: this.formBuilder.control('', [trimmedRequired]),
    device_model: this.formBuilder.control('', [trimmedRequired]),
    /** The six frozen issue flags (Module Plan v4 required feature 2): at least one. */
    issues: this.formBuilder.control<IssueFlagKey[]>([], [atLeastOneIssue]),
    /** Optional extra detail on top of the picked issues. */
    issue_description: this.formBuilder.control('', [Validators.maxLength(500)]),
    location: this.formBuilder.control(this.config.locations[0] ?? '', [trimmedRequired]),
    booking_date: this.formBuilder.control('', [Validators.required, notPastDate]),
    booking_time: this.formBuilder.control('', [Validators.required]),
    service_id: this.formBuilder.control('', [Validators.required]),
    technician_id: this.formBuilder.control(''),
  });

  /** Signal mirror of the form value, so the template and computeds stay reactive. */
  readonly values = signal(this.form.getRawValue());

  private readonly takenSet = computed(
    () => new Set(this.takenSlots().map((slot) => normalizeTime(slot))),
  );
  readonly freeSlots = computed(() =>
    this.slotTimes.filter((slot) => !this.takenSet().has(slot) && !this.isPast(slot)),
  );

  readonly brandSuggestions = computed(() => {
    const query = this.brandQuery();
    const results = searchBrands(this.deviceCatalog.catalog(), query);
    return results.length === 1 && sameText(results[0], query) ? [] : results;
  });

  /** Models of the typed brand; if the brand is unknown or empty, search every brand. */
  readonly modelSuggestions = computed<DeviceSuggestion[]>(() => {
    const catalog = this.deviceCatalog.catalog();
    const query = this.modelQuery();
    const brand = findBrand(catalog, this.values().device_brand);
    const results = brand
      ? searchModels(catalog, brand.name, query).map((model) => ({ brand: brand.name, model }))
      : searchDevices(catalog, query);
    return results.length === 1 && sameText(results[0].model, query) ? [] : results;
  });

  readonly modelPlaceholder = computed(() =>
    findBrand(this.deviceCatalog.catalog(), this.values().device_brand)
      ? 'Start typing the model'
      : 'e.g. Galaxy A55, iPhone 13, Redmi Note 13',
  );

  readonly suggestedService = computed(() => suggestService(this.services(), this.values().issues));
  readonly selectedService = computed(
    () => this.services().find((item) => item.id === this.values().service_id) ?? null,
  );
  readonly estimate = computed(() => estimatePrice(this.selectedService(), this.values().issues));
  readonly pickedIssueLabels = computed(() =>
    ISSUE_DEFINITIONS.filter((issue) => this.values().issues.includes(issue.key)).map(
      (issue) => issue.label,
    ),
  );

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.values.set(this.form.getRawValue());
    });
    // "Book again" on Repairs passes the old device/service/place as query params.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      void this.prefill(params.get('brand'), params.get('model'), params.get('service'), params.get('location'));
    });
  }

  async ngOnInit(): Promise<void> {
    void this.deviceCatalog.load();
    await this.booking.ensureLoaded();
    this.applyDefaultDate();
    this.syncSuggestedService();
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
      this.serviceChosenByUser.set(true);
    }
    this.setStep(0);
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

  /** Picks the artist's service icon from the service name; falls back to the tools icon. */
  serviceImage(name: string): string {
    const text = name.toLowerCase();
    if (text.includes('screen') || text.includes('display')) return 'assets/icons/service-screen.png';
    if (text.includes('battery')) return 'assets/icons/service-battery.png';
    if (text.includes('water') || text.includes('liquid')) return 'assets/icons/service-water.png';
    return 'assets/icons/service-repair.png';
  }

  isInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.showErrors());
  }

  // ---------- step navigation ----------

  back(): void {
    if (this.step() > 0) {
      this.setStep(this.step() - 1);
    }
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

  setStep(index: number): void {
    this.step.set(index);
    this.showErrors.set(false);
    this.activeField.set(null);
    void this.content?.scrollToTop(0);
  }

  private stepControls(step: number) {
    const c = this.form.controls;
    switch (step) {
      case 0:
        return [c.device_brand, c.device_model, c.issues, c.issue_description];
      case 1:
        return [c.location, c.booking_date, c.booking_time];
      default:
        return [c.service_id, c.technician_id];
    }
  }

  private stepIsValid(step: number): boolean {
    return this.stepControls(step).every((control) => control.valid);
  }

  private touchStep(step: number): void {
    this.stepControls(step).forEach((control) => control.markAsTouched());
  }

  // ---------- step 1: device and problem ----------

  isCurrentDevice(device: PastDevice): boolean {
    const v = this.values();
    return sameText(v.device_brand, device.brand) && sameText(v.device_model, device.model);
  }

  pickPastDevice(device: PastDevice): void {
    this.form.controls.device_brand.setValue(device.brand);
    this.form.controls.device_model.setValue(device.model);
    this.form.controls.device_brand.markAsTouched();
    this.form.controls.device_model.markAsTouched();
    this.activeField.set(null);
  }

  onBrandInput(event: Event): void {
    this.brandQuery.set(this.eventValue(event));
    this.activeField.set('brand');
  }

  onModelInput(event: Event): void {
    this.modelQuery.set(this.eventValue(event));
    this.activeField.set('model');
  }

  pickBrand(brand: string): void {
    this.form.controls.device_brand.setValue(brand);
    this.form.controls.device_brand.markAsTouched();
    this.brandQuery.set(brand);
    this.activeField.set(null);
  }

  pickDevice(item: DeviceSuggestion): void {
    this.form.controls.device_brand.setValue(item.brand);
    this.form.controls.device_model.setValue(item.model);
    this.form.controls.device_model.markAsTouched();
    this.brandQuery.set(item.brand);
    this.modelQuery.set(item.model);
    this.activeField.set(null);
  }

  closeSuggestions(): void {
    this.activeField.set(null);
  }

  isIssuePicked(key: IssueFlagKey): boolean {
    return this.values().issues.includes(key);
  }

  toggleIssue(key: IssueFlagKey): void {
    const control = this.form.controls.issues;
    const picked = control.value;
    control.setValue(picked.includes(key) ? picked.filter((item) => item !== key) : [...picked, key]);
    control.markAsTouched();
    this.syncSuggestedService();
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

  // ---------- step 3: review ----------

  pickService(serviceId: string): void {
    this.form.controls.service_id.setValue(serviceId);
    this.form.controls.service_id.markAsTouched();
    this.serviceChosenByUser.set(true);
  }

  /** Keeps the pre-selected service in line with the picked issues until the customer chooses one. */
  private syncSuggestedService(): void {
    if (this.serviceChosenByUser()) {
      return;
    }
    const suggestion = suggestService(this.services(), this.form.controls.issues.value);
    this.form.controls.service_id.setValue(suggestion?.id ?? '');
  }

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
      issues: ISSUE_DEFINITIONS.filter((issue) => value.issues.includes(issue.key)).map(
        (issue) => issue.key,
      ),
      issue_description: value.issue_description.trim(),
    };
  }

  private resetForm(): void {
    this.form.reset({
      device_brand: '',
      device_model: '',
      issues: [],
      issue_description: '',
      location: this.config.locations[0] ?? '',
      booking_date: '',
      booking_time: '',
      service_id: '',
      technician_id: '',
    });
    this.serviceChosenByUser.set(false);
    this.brandQuery.set('');
    this.modelQuery.set('');
    this.applyDefaultDate();
    this.step.set(0);
    this.showErrors.set(false);
  }

  private eventValue(event: Event): string {
    const value = (event as CustomEvent<{ value?: string | null }>).detail?.value;
    return value ?? '';
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
