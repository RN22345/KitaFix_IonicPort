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
  browseModels,
  findBrand,
  listedDevice,
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
  Repair,
  formatBookingDate,
  formatTime,
  isActiveRepair,
  isIssueKey,
  normalizeTime,
  shortRepairId,
  timeToMinutes,
} from '../../models/repair.model';
import { estimatePrice, formatCurrency } from '../../pricing/price-estimate';
import { issueCoveredBy, serviceForIssues, suggestService } from '../../pricing/service-match';
import { RepairsService } from '../../services/repairs.service';
import { StatusBadgeComponent } from '../../ui/status-badge/status-badge.component';
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

/** Past-device chips shown before "Show more". */
const DEVICE_CHIP_LIMIT = 6;

/**
 * Is the typed device acceptable?
 *   listed  - brand + model are in the catalog
 *   past    - a device this customer booked before (may be unlisted)
 *   manual  - "Not in the list" is ticked, or the catalog could not load
 *   brand / model - not in the list: pick one, or tick "Not in the list"
 */
type DeviceCheck = 'empty' | 'listed' | 'past' | 'manual' | 'brand' | 'model';

type Period = 'AM' | 'PM';

/** A bookable slot split into 24-hour parts, for the clock face. */
interface SlotEntry {
  slot: string;
  hour24: number;
  minute: number;
}

/** One tappable number on the clock face. */
interface ClockMark {
  key: string;
  label: string;
  aria: string;
  hour24: number;
  /** Set on minute marks; hour marks have none. */
  slot: string | null;
  x: number;
  y: number;
  disabled: boolean;
  selected: boolean;
}

/** How far from the centre the numbers sit, as a percentage of the dial. */
const CLOCK_RADIUS = 38;

const pad2 = (value: number) => String(value).padStart(2, '0');
const periodOf = (hour24: number): Period => (hour24 < 12 ? 'AM' : 'PM');
const hour12 = (hour24: number) => hour24 % 12 || 12;

/** Dial position for an angle in degrees (0 = 12 o'clock, clockwise). */
function dialPoint(angle: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return {
    x: Number((CLOCK_RADIUS * Math.sin(radians)).toFixed(2)),
    y: Number((-CLOCK_RADIUS * Math.cos(radians)).toFixed(2)),
  };
}

/**
 * New Booking in 3 steps: Device (what and what's wrong) -> Schedule (branch,
 * date, time) -> Review (summary, optional technician, estimate).
 * The customer never picks a "service": it follows from the issues
 * (serviceForIssues) because the issue chips already say the same thing.
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
    StatusBadgeComponent,
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
  @ViewChild('modelInput') private modelInput?: IonInput;

  readonly steps = ['Device', 'Schedule', 'Review'] as const;
  readonly step = signal(0);
  /** Which way the last step change went, for the slide animation. */
  readonly direction = signal<'forward' | 'back'>('forward');
  readonly isLastStep = computed(() => this.step() === this.steps.length - 1);

  readonly locations = this.config.locations;
  readonly slotTimes = this.config.slotTimes;
  readonly services = this.booking.serviceOptions;
  readonly technicians = this.booking.technicianOptions;
  readonly myDevices = this.booking.myDevices;
  readonly currency = this.config.currency;
  readonly issueOptions = ISSUE_DEFINITIONS;

  // ---------- anti-spam limit ----------
  readonly maxActive = this.booking.maxActiveBookings;
  readonly bookingsLeft = this.booking.bookingsLeft;
  readonly activeRepairs = computed(() => this.booking.myRepairs().filter((repair) => isActiveRepair(repair)));
  /** Repairs are loaded, so the limit below is real (not "0 repairs while loading"). */
  readonly loaded = signal(false);
  /** The booking that was just made: shows the success screen. */
  readonly booked = signal<Repair | null>(null);
  readonly locked = computed(() => this.loaded() && this.bookingsLeft() === 0 && !this.booked());

  readonly minDate = toLocalIsoDate(new Date());
  readonly saving = signal(false);
  /** True after a failed Next/Book press, so the current step shows its errors. */
  readonly showErrors = signal(false);
  readonly takenSlots = signal<string[]>([]);
  readonly loadingSlots = signal(false);
  readonly selectedDate = signal('');

  /** Which device field shows its list. */
  readonly activeField = signal<'brand' | 'model' | null>(null);
  private readonly brandQuery = signal('');
  private readonly modelQuery = signal('');
  /** "Not in the list" ticked: brand and model are typed freely. */
  readonly manualDevice = signal(false);
  readonly catalogReady = this.deviceCatalog.ready;
  readonly deviceCatalogFailed = this.deviceCatalog.failed;
  /** Typing freely: ticked, or the list could not load (offline first run). */
  readonly typingFreely = computed(() => this.manualDevice() || this.deviceCatalog.failed());
  readonly showAllDevices = signal(false);

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

  // ---------- analog time picker ----------

  /** Pick the hour first; hours with several slots then ask for the minutes. */
  readonly clockPhase = signal<'hour' | 'minute'>('hour');
  /** The hour (0-23) whose minutes are showing. */
  readonly clockHour = signal<number | null>(null);
  private readonly periodChoice = signal<Period | null>(null);

  private readonly slotEntries = computed<SlotEntry[]>(() =>
    this.slotTimes.map((slot) => {
      const minutes = timeToMinutes(slot);
      return { slot, hour24: Math.floor(minutes / 60), minute: minutes % 60 };
    }),
  );

  /** AM / PM, but only the halves of the day that have slots. */
  readonly periods = computed<Period[]>(() => {
    const found = new Set(this.slotEntries().map((entry) => periodOf(entry.hour24)));
    return (['AM', 'PM'] as Period[]).filter((period) => found.has(period));
  });

  private readonly selectedEntry = computed<SlotEntry | null>(() => {
    const time = this.values().booking_time;
    if (!time) return null;
    const chosen = normalizeTime(time);
    return this.slotEntries().find((entry) => normalizeTime(entry.slot) === chosen) ?? null;
  });

  readonly activePeriod = computed<Period>(() => {
    const periods = this.periods();
    const forced = this.periodChoice();
    if (forced && periods.includes(forced)) return forced;
    const selected = this.selectedEntry();
    if (selected) return periodOf(selected.hour24);
    return periods[0] ?? 'AM';
  });

  /** The hour shown in the readout and, with several slots, the one to pick minutes in. */
  private readonly displayHour = computed<number | null>(() => {
    const browsing = this.clockHour();
    if (this.clockPhase() === 'minute' && browsing !== null) return browsing;
    const selected = this.selectedEntry();
    return selected && periodOf(selected.hour24) === this.activePeriod() ? selected.hour24 : null;
  });

  readonly canBrowseMinutes = computed(() => {
    const hour = this.displayHour();
    return hour !== null && this.slotEntries().filter((entry) => entry.hour24 === hour).length > 1;
  });

  readonly clockReadout = computed(() => {
    const hour = this.displayHour();
    const selected = this.selectedEntry();
    return {
      hour: hour === null ? '--' : String(hour12(hour)),
      minute: hour !== null && selected?.hour24 === hour ? pad2(selected.minute) : '--',
    };
  });

  readonly clockMarks = computed<ClockMark[]>(() => {
    const entries = this.slotEntries();
    const selected = this.selectedEntry();
    const browsing = this.clockPhase() === 'minute' ? this.clockHour() : null;

    if (browsing !== null) {
      return entries
        .filter((entry) => entry.hour24 === browsing)
        .map((entry) => ({
          key: `m-${entry.slot}`,
          label: pad2(entry.minute),
          aria: formatTime(entry.slot),
          hour24: entry.hour24,
          slot: entry.slot,
          ...dialPoint(entry.minute * 6),
          disabled: this.isUnavailable(entry.slot),
          selected: selected?.slot === entry.slot,
        }));
    }

    const period = this.activePeriod();
    return Array.from({ length: 12 }, (_, index) => {
      const hour = index + 1;
      const hour24 = (hour % 12) + (period === 'PM' ? 12 : 0);
      const inHour = entries.filter((entry) => entry.hour24 === hour24);
      return {
        key: `h-${period}-${hour}`,
        label: String(hour),
        aria: `${hour} ${period}`,
        hour24,
        slot: null,
        ...dialPoint((hour % 12) * 30),
        disabled: inHour.every((entry) => this.isUnavailable(entry.slot)),
        selected: selected?.hour24 === hour24,
      };
    });
  });

  /** Where the hand points, in degrees; null while nothing on this face is picked. */
  readonly handAngle = computed<number | null>(() => {
    const selected = this.selectedEntry();
    if (!selected) return null;
    if (this.clockPhase() === 'minute') {
      return this.clockHour() === selected.hour24 ? selected.minute * 6 : null;
    }
    return periodOf(selected.hour24) === this.activePeriod() ? (selected.hour24 % 12) * 30 : null;
  });

  // ---------- device lists ----------

  readonly shownDevices = computed(() =>
    this.showAllDevices() ? this.myDevices() : this.myDevices().slice(0, DEVICE_CHIP_LIMIT),
  );
  readonly hiddenDeviceCount = computed(() => this.myDevices().length - this.shownDevices().length);

  private readonly currentBrand = computed(() =>
    findBrand(this.deviceCatalog.catalog(), this.values().device_brand),
  );

  readonly brandSuggestions = computed(() => {
    const query = this.brandQuery();
    const results = searchBrands(this.deviceCatalog.catalog(), query, query.trim() ? 8 : 10);
    return results.length === 1 && sameText(results[0], query) ? [] : results;
  });

  /**
   * Models of the chosen brand: the whole brand (newest first) before typing,
   * matches after. With no known brand, search every brand ("iphone 13").
   */
  readonly modelSuggestions = computed<DeviceSuggestion[]>(() => {
    const catalog = this.deviceCatalog.catalog();
    const query = this.modelQuery();
    const brand = this.currentBrand();
    if (!brand) {
      return searchDevices(catalog, query);
    }
    const browsing = !query.trim() || brand.models.some((model) => sameText(model, query));
    const models = browsing ? browseModels(catalog, brand.name) : searchModels(catalog, brand.name, query, 30);
    return models.map((model) => ({ brand: brand.name, model }));
  });

  /** "1,532 Samsung models" heading above the list while browsing. */
  readonly modelListHeading = computed(() => {
    const brand = this.currentBrand();
    if (!brand) return '';
    const query = this.modelQuery().trim();
    const browsing = !query || brand.models.some((model) => sameText(model, query));
    const count = brand.models.length.toLocaleString();
    return browsing ? `${count} ${brand.name} models · type to narrow` : `${brand.name} models`;
  });

  readonly modelPlaceholder = computed(() =>
    this.currentBrand() ? 'Tap to choose, or start typing' : 'e.g. Galaxy A55, iPhone 13, Redmi Note 13',
  );

  readonly deviceCheck = computed<DeviceCheck>(() => {
    const { device_brand: brand, device_model: model } = this.values();
    if (!brand.trim() || !model.trim()) return 'empty';
    if (this.typingFreely() || !this.catalogReady()) return 'manual';
    if (listedDevice(this.deviceCatalog.catalog(), brand, model)) return 'listed';
    if (this.myDevices().some((device) => sameText(device.brand, brand) && sameText(device.model, model))) {
      return 'past';
    }
    return this.currentBrand() ? 'model' : 'brand';
  });
  readonly brandVerified = computed(() => !this.typingFreely() && !!this.currentBrand());
  readonly deviceVerified = computed(() => ['listed', 'past'].includes(this.deviceCheck()));

  // ---------- review ----------

  readonly pickedIssues = computed(() =>
    ISSUE_DEFINITIONS.filter((issue) => this.values().issues.includes(issue.key)),
  );
  /** The main job for the estimate; null when no service fixes the picked issues. */
  readonly mainService = computed(() => suggestService(this.services(), this.values().issues));
  /** What gets stored as repairs.service_id (required), see serviceForIssues. */
  private readonly bookingService = computed(() => serviceForIssues(this.services(), this.values().issues));
  readonly estimate = computed(() => estimatePrice(this.mainService(), this.values().issues));
  /** The picked issues the main service does not fix, with their fee. */
  readonly extraIssues = computed(() => {
    const covered = issueCoveredBy(this.mainService());
    return this.pickedIssues().filter((issue) => issue.key !== covered && issue.extraFee > 0);
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.values.set(this.form.getRawValue());
    });
    // "Book again" on Repairs and the issue tiles on Home pass query params.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      void this.prefill({
        brand: params.get('brand'),
        model: params.get('model'),
        serviceId: params.get('service'),
        location: params.get('location'),
        issue: params.get('issue'),
      });
    });
  }

  async ngOnInit(): Promise<void> {
    void this.deviceCatalog.load();
    await this.booking.ensureLoaded();
    this.loaded.set(true);
    this.applyDefaultDate();
    await this.loadSlots();
  }

  private async prefill(params: {
    brand: string | null;
    model: string | null;
    serviceId: string | null;
    location: string | null;
    issue: string | null;
  }): Promise<void> {
    const { brand, model, serviceId, location, issue } = params;
    if (!brand && !model && !serviceId && !location && !issue) {
      return;
    }
    await this.booking.ensureLoaded();
    this.booked.set(null);
    const controls = this.form.controls;
    if (brand) controls.device_brand.setValue(brand);
    if (model) controls.device_model.setValue(model);
    if (location && this.locations.includes(location)) {
      controls.location.setValue(location);
    }
    // An old booking's service says which issue it was for.
    const fromService = issueCoveredBy(this.services().find((item) => item.id === serviceId));
    const picked = [issue && isIssueKey(issue) ? issue : null, fromService].filter(
      (key): key is IssueFlagKey => key !== null,
    );
    if (picked.length > 0) {
      controls.issues.setValue([...new Set(picked)]);
    }
    this.setStep(0);
    await this.loadSlots();
  }

  // ---------- view helpers ----------

  money(amount: number): string {
    return formatCurrency(amount, this.currency);
  }

  prettyDate(date = this.values().booking_date): string {
    return date ? formatBookingDate(date) : '';
  }

  prettyTime(time: string): string {
    return formatTime(time);
  }

  shortId(id: string): string {
    return shortRepairId(id);
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

  isInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.showErrors());
  }

  /** The device is filled in but not in the list (and "Not in the list" is not ticked). */
  deviceProblem(): 'brand' | 'model' | null {
    const check = this.deviceCheck();
    if (check !== 'brand' && check !== 'model') return null;
    const touched = this.form.controls.device_model.touched || this.showErrors();
    return touched && this.activeField() === null ? check : null;
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
    if (this.step() === 0) {
      this.useCatalogSpelling();
    }
    this.setStep(this.step() + 1);
  }

  setStep(index: number): void {
    this.direction.set(index < this.step() ? 'back' : 'forward');
    this.step.set(index);
    this.showErrors.set(false);
    this.activeField.set(null);
    this.resetClock();
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
        return [c.technician_id];
    }
  }

  private stepIsValid(step: number): boolean {
    const controlsValid = this.stepControls(step).every((control) => control.valid);
    if (step === 0) {
      return controlsValid && ['listed', 'past', 'manual'].includes(this.deviceCheck());
    }
    return controlsValid;
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
    this.brandQuery.set(device.brand);
    this.modelQuery.set(device.model);
    this.activeField.set(null);
  }

  toggleManualDevice(): void {
    this.manualDevice.update((value) => !value);
    this.activeField.set(null);
  }

  openList(field: 'brand' | 'model', event?: Event): void {
    if (this.typingFreely()) return;
    // The fields are read-only here, so there is nothing to filter by: always show the full list.
    if (field === 'brand') this.brandQuery.set('');
    if (field === 'model') this.modelQuery.set('');
    this.activeField.set(field);
    // Bring the field to the top so its list has room above the keyboard.
    const target = event?.target as HTMLElement | null;
    target?.closest('.field')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  onBrandInput(event: Event): void {
    this.brandQuery.set(this.eventValue(event));
    if (!this.typingFreely()) this.activeField.set('brand');
  }

  onModelInput(event: Event): void {
    this.modelQuery.set(this.eventValue(event));
    if (!this.typingFreely()) this.activeField.set('model');
  }

  /** Picking a brand clears a model of another brand and opens the model list. */
  pickBrand(brand: string): void {
    const controls = this.form.controls;
    const keepModel = listedDevice(this.deviceCatalog.catalog(), brand, controls.device_model.value);
    controls.device_brand.setValue(brand);
    controls.device_brand.markAsTouched();
    if (!keepModel) {
      controls.device_model.setValue('');
      controls.device_model.markAsUntouched();
    }
    this.brandQuery.set(brand);
    this.modelQuery.set(controls.device_model.value);
    this.activeField.set(null);
    // Straight on to the model list.
    setTimeout(() => void this.modelInput?.setFocus(), 50);
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

  /** Store the catalog's spelling ("samsung galaxy a55 5g" -> "Samsung" + "Galaxy A55 5G"). */
  private useCatalogSpelling(): void {
    if (this.typingFreely()) return;
    const v = this.form.controls;
    const listed = listedDevice(this.deviceCatalog.catalog(), v.device_brand.value, v.device_model.value);
    if (listed) {
      v.device_brand.setValue(listed.brand);
      v.device_model.setValue(listed.model);
    }
  }

  isIssuePicked(key: IssueFlagKey): boolean {
    return this.values().issues.includes(key);
  }

  toggleIssue(key: IssueFlagKey): void {
    const control = this.form.controls.issues;
    const picked = control.value;
    control.setValue(picked.includes(key) ? picked.filter((item) => item !== key) : [...picked, key]);
    control.markAsTouched();
  }

  // ---------- step 2: schedule ----------

  pickLocation(location: string): void {
    this.form.controls.location.setValue(location);
    this.form.controls.booking_time.setValue('');
    this.resetClock();
    void this.loadSlots();
  }

  /** Back to the hour face (the slot itself is cleared by the caller). */
  private resetClock(): void {
    this.clockPhase.set('hour');
    this.clockHour.set(null);
    this.periodChoice.set(null);
  }

  showHours(): void {
    this.clockPhase.set('hour');
  }

  showMinutes(): void {
    const hour = this.displayHour();
    if (hour === null || !this.canBrowseMinutes()) return;
    this.clockHour.set(hour);
    this.clockPhase.set('minute');
  }

  pickPeriod(period: Period): void {
    this.periodChoice.set(period);
    this.clockPhase.set('hour');
  }

  /** An hour either books its only slot, or opens the minutes for that hour. */
  pickMark(mark: ClockMark): void {
    if (mark.disabled) return;
    if (mark.slot) {
      this.pickSlot(mark.slot);
      return;
    }
    const inHour = this.slotEntries().filter((entry) => entry.hour24 === mark.hour24);
    if (inHour.length === 1) {
      this.clockHour.set(null);
      this.pickSlot(inHour[0].slot);
      return;
    }
    this.clockHour.set(mark.hour24);
    this.clockPhase.set('minute');
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
    this.resetClock();
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

  // ---------- step 3: review and book ----------

  async submit(): Promise<void> {
    const badStep = [0, 1, 2].find((index) => !this.stepIsValid(index));
    if (badStep !== undefined) {
      this.touchStep(badStep);
      this.setStep(badStep);
      this.showErrors.set(true);
      await this.showToast('Please complete the highlighted fields.', 'warning');
      return;
    }
    const service = this.bookingService();
    if (!service) {
      await this.showToast('The shop menu has not loaded yet. Please try again in a moment.', 'warning');
      return;
    }

    this.saving.set(true);
    try {
      const repair = await this.booking.createBooking(this.buildDraft(service.id));
      this.booked.set(repair);
      void this.content?.scrollToTop(0);
    } catch (error) {
      await this.showToast(bookingErrorMessage(error), 'danger');
      if (error instanceof BookingError && error.code === 'SLOT_TAKEN') {
        this.form.controls.booking_time.setValue('');
        this.setStep(1);
        await this.loadSlots();
      }
      if (error instanceof BookingError && error.code === 'LIMIT_REACHED') {
        // Another device booked meanwhile: reload so the Book tab locks.
        await this.booking.refreshMyRepairs();
      }
    } finally {
      this.saving.set(false);
    }
  }

  /** Success screen buttons. */
  async finish(target: 'repairs' | 'home' | 'again'): Promise<void> {
    this.resetForm();
    if (target === 'repairs') await this.router.navigateByUrl('/tabs/my-repairs');
    if (target === 'home') await this.router.navigateByUrl('/tabs/dashboard');
    void this.loadSlots();
  }

  goToRepairs(): void {
    void this.router.navigateByUrl('/tabs/my-repairs');
  }

  private applyDefaultDate(): void {
    const date = tomorrowIsoDate();
    this.form.controls.booking_date.setValue(date);
    this.selectedDate.set(date);
  }

  private buildDraft(serviceId: string): BookingDraft {
    const value = this.form.getRawValue();
    return {
      service_id: serviceId,
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
      technician_id: '',
    });
    this.brandQuery.set('');
    this.modelQuery.set('');
    this.manualDevice.set(false);
    this.showAllDevices.set(false);
    this.resetClock();
    this.applyDefaultDate();
    this.direction.set('forward');
    this.step.set(0);
    this.showErrors.set(false);
    this.booked.set(null);
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