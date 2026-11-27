import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AlertController, IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonInput,
  IonNote, IonRefresher, IonRefresherContent, IonSearchbar, IonSegment, IonSegmentButton,
  IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar, ModalController, ToastController,
} from '@ionic/angular';
import {
  StatusBadgeComponent, formatBookingDate, formatTime, issueLabels, shortRepairId, statusMeta,
} from '@kitafix/booking';
import { RepairStatus } from '@kitafix/shared-types';
import { repairOpsErrorMessage } from '../../models/repair-ops-error';
import {
  QueueFilter, QueueRepair, QueueSortKey, REMARKS_MAX_LENGTH, RepairOpsHistory, isConfirmed,
  nextStatuses, serviceLogActionLabel,
} from '../../models/repair-ops.model';
import { RepairOpsService } from '../../services/repair-ops.service';
import { ServiceLogModalComponent } from '../../ui/service-log-modal/service-log-modal.component';

const PAGE_SIZE = 10;

/** Screen 2 - Repair Queue: searchable, filterable, sortable, paginated staff queue. */
@Component({
  selector: 'app-repair-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonInput, IonNote, IonRefresher,
    IonRefresherContent, IonSearchbar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption,
    IonSpinner, IonTitle, IonToolbar, StatusBadgeComponent,
  ],
  templateUrl: './repair-queue.page.html',
  styleUrl: './repair-queue.page.scss',
})
export class RepairQueuePage implements OnInit {
  private readonly ops = inject(RepairOpsService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly modals = inject(ModalController);

  readonly repairs = this.ops.repairs;
  readonly filter = this.ops.filter;
  readonly loading = this.ops.loading;
  readonly error = this.ops.error;
  readonly history = this.ops.history;
  readonly historyLoading = this.ops.historyLoading;
  readonly serviceLogs = this.ops.serviceLogs;
  readonly serviceLogsLoading = this.ops.serviceLogsLoading;
  /** SA = shop staff (full queue tools). TECH = technician (own jobs: notes, history, service log). */
  readonly isStaff = this.ops.isStaff;
  readonly isTechnician = this.ops.isTechnician;
  readonly actionLabel = serviceLogActionLabel;
  readonly expandedRepairIds = signal<Set<string>>(new Set());
  readonly search = signal('');
  readonly statusFilter = signal<RepairStatus | 'all'>('all');
  readonly technicianFilter = signal('');
  readonly serviceFilter = signal('');
  readonly scheduledFrom = signal('');
  readonly scheduledTo = signal('');
  readonly repairFrom = signal('');
  readonly repairTo = signal('');
  readonly sortKey = signal<QueueSortKey>('booking_date');
  readonly sortAscending = signal(true);
  readonly categoryMenuOpen = signal(false);
  readonly directionMenuOpen = signal(false);
  readonly filterPanelOpen = signal(false);
  readonly page = signal(1);
  readonly pageSize = PAGE_SIZE;
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount()));
  readonly statuses: readonly RepairStatus[] = ['pending', 'in_progress', 'testing', 'completed', 'cancelled'];
  readonly statusMeta = statusMeta;
  readonly id = shortRepairId;
  readonly date = formatBookingDate;
  readonly time = formatTime;

  readonly technicians = computed(() => {
    const options = new Map<string, string>();
    for (const repair of this.repairs()) {
      if (repair.technician_id) options.set(repair.technician_id, repair.technician_name ?? repair.technician_id);
    }
    return [...options].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly services = computed(() => {
    const options = new Map<string, string>();
    for (const repair of this.repairs()) options.set(repair.service_id, repair.service_name);
    return [...options].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filtered = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const scheduledFrom = this.scheduledFrom();
    const scheduledTo = this.scheduledTo();
    const repairFrom = this.repairFrom();
    const repairTo = this.repairTo();
    const status = this.statusFilter();
    const technician = this.technicianFilter();
    const service = this.serviceFilter();
    const baseFilter = this.filter();

    return this.repairs().filter((repair) => {
      if (baseFilter === 'waiting' && repair.status !== 'pending') return false;
      if (baseFilter === 'processed' && repair.status === 'pending') return false;
      if (status !== 'all' && repair.status !== status) return false;
      if (technician === 'unassigned' && repair.technician_id !== null) return false;
      if (technician && technician !== 'unassigned' && repair.technician_id !== technician) return false;
      if (service && repair.service_id !== service) return false;
      if (scheduledFrom && repair.booking_date < scheduledFrom) return false;
      if (scheduledTo && repair.booking_date > scheduledTo) return false;
      const actualRepairDate = this.localDate(repair.repair_started_at);
      if (repairFrom && (!actualRepairDate || actualRepairDate < repairFrom)) return false;
      if (repairTo && (!actualRepairDate || actualRepairDate > repairTo)) return false;
      if (!query) return true;
      const terms = [
        repair.id, shortRepairId(repair.id), repair.customer_name, repair.device_brand,
        repair.device_model, repair.issue_description ?? '', issueLabels(repair).join(' '),
      ];
      return terms.some((term) => term.toLocaleLowerCase().includes(query));
    }).sort((a, b) => this.compare(a, b));
  });

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly visible = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  issues(repair: QueueRepair): string {
    const summary = repair.issue_description?.trim();
    return summary || issueLabels(repair).join(', ') || '-';
  }

  confirmed = isConfirmed;
  finished(repair: QueueRepair): boolean {
    return nextStatuses(repair.status).length === 0;
  }
  canConfirm(repair: QueueRepair): boolean {
    return repair.status === 'pending' && !isConfirmed(repair);
  }
  canReschedule(repair: QueueRepair): boolean {
    return repair.status === 'pending';
  }

  onFilter(event: Event): void {
    this.ops.filter.set(this.value(event) as QueueFilter);
    this.page.set(1);
  }

  setSearch(event: Event): void {
    this.search.set(this.value(event));
    this.page.set(1);
  }

  setStatusFilter(event: Event): void {
    this.statusFilter.set((this.value(event) || 'all') as RepairStatus | 'all');
    this.page.set(1);
  }

  setTechnicianFilter(event: Event): void {
    this.technicianFilter.set(this.value(event));
    this.page.set(1);
  }

  setServiceFilter(event: Event): void {
    this.serviceFilter.set(this.value(event));
    this.page.set(1);
  }

  setDateFilter(filter: 'scheduledFrom' | 'scheduledTo' | 'repairFrom' | 'repairTo', event: Event): void {
    this[filter].set(this.value(event));
    this.page.set(1);
  }

  toggleFilterPanel(): void {
    this.filterPanelOpen.update((open) => !open);
  }

  readonly sortCategories: readonly { value: QueueSortKey; label: string }[] = [
    { value: 'id', label: 'Repair ID' },
    { value: 'customer_name', label: 'Customer Name' },
    { value: 'status', label: 'Status' },
    { value: 'booking_date', label: 'Scheduled Date' },
    { value: 'technician_name', label: 'Technician' },
  ];

  sortCategoryLabel(): string {
    return this.sortCategories.find((item) => item.value === this.sortKey())?.label ?? 'Scheduled Date';
  }

  toggleCategoryMenu(): void {
    this.directionMenuOpen.set(false);
    this.categoryMenuOpen.update((open) => !open);
  }

  toggleDirectionMenu(): void {
    this.categoryMenuOpen.set(false);
    this.directionMenuOpen.update((open) => !open);
  }

  selectSortKey(key: QueueSortKey): void {
    this.sortKey.set(key);
    this.categoryMenuOpen.set(false);
    this.page.set(1);
  }

  selectSortAscending(ascending: boolean): void {
    this.sortAscending.set(ascending);
    this.directionMenuOpen.set(false);
    this.page.set(1);
  }

  previousPage(): void {
    this.page.set(Math.max(1, this.currentPage() - 1));
  }

  nextPage(): void {
    this.page.set(Math.min(this.pageCount(), this.currentPage() + 1));
  }

  toggleDetails(repairId: string): void {
    let opening = false;
    this.expandedRepairIds.update((expanded) => {
      const next = new Set(expanded);
      opening = !next.has(repairId);
      if (!opening) next.delete(repairId);
      else next.add(repairId);
      return next;
    });
    if (opening) {
      void this.loadHistory(repairId);
      void this.loadServiceLogs(repairId);
    }
  }

  /** Technician names come from the history row; fall back for older rows. */
  private technicianLabel(name: string | null, id: string | null): string {
    if (!id) return 'Unassigned';
    return name ?? 'Unknown technician';
  }

  canLog(repair: QueueRepair): boolean {
    return this.ops.serviceLogBlocked(repair) === null;
  }

  logBlockedReason(repair: QueueRepair): string | null {
    return this.ops.serviceLogBlocked(repair);
  }

  historySummary(item: RepairOpsHistory): string {
    if (item.event_type === 'status') {
      return `Status: ${statusMeta(item.previous_status!).label} → ${statusMeta(item.new_status!).label}`;
    }
    if (item.event_type === 'technician') {
      return `Technician: ${this.technicianLabel(item.previous_technician_name, item.previous_technician_id)} → ${
        this.technicianLabel(item.new_technician_name, item.new_technician_id)
      }`;
    }
    if (item.event_type === 'schedule') {
      return `Schedule: ${item.previous_booking_date}, ${formatTime(item.previous_booking_time ?? '')} → ${
        item.new_booking_date
      }, ${formatTime(item.new_booking_time ?? '')}`;
    }
    return 'Repair note';
  }

  dateTime(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  private localDate(value: string | null): string {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  ngOnInit(): void {
    void this.ops.ensureLoaded();
  }

  async refresh(event: Event): Promise<void> {
    await this.ops.load();
    (event as CustomEvent).detail.complete();
  }

  async confirm(repair: QueueRepair): Promise<void> {
    await this.run(() => this.ops.confirm(repair), `${shortRepairId(repair.id)} confirmed`);
  }

  async changeStatus(repair: QueueRepair): Promise<void> {
    const statuses = nextStatuses(repair.status);
    if (statuses.length === 0) return;

    const alert = await this.alerts.create({
      header: `Update ${shortRepairId(repair.id)}`,
      message: `Current status: ${statusMeta(repair.status).label}`,
      inputs: statuses.map((to) => ({
        type: 'radio' as const,
        label: statusMeta(to).label,
        value: to,
      })),
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Update', role: 'confirm' }],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    const selected = statuses.find((status) => status === data?.values);
    if (role !== 'confirm' || !selected) return;

    // Optional remarks, shown in the status timeline ("Remarks (if applicable)").
    const remarksAlert = await this.alerts.create({
      header: 'Remarks (optional)',
      message: `${statusMeta(repair.status).label} → ${statusMeta(selected).label}`,
      inputs: [{
        name: 'remarks',
        type: 'textarea',
        placeholder: selected === 'cancelled' ? 'Reason for cancelling' : 'e.g. test passed, waiting for parts',
        attributes: { maxlength: REMARKS_MAX_LENGTH },
      }],
      buttons: [{ text: 'Back', role: 'cancel' }, { text: 'Update status', role: 'confirm' }],
    });
    await remarksAlert.present();
    const { role: remarksRole, data: remarksData } = await remarksAlert.onDidDismiss();
    if (remarksRole !== 'confirm') return;

    const updated = await this.run(
      () => this.ops.changeStatus(repair, selected, String(remarksData?.values?.remarks ?? '')),
      `${shortRepairId(repair.id)} is now ${statusMeta(selected).label}`,
    );
    if (updated) await this.loadHistory(repair.id);
  }

  async assign(repair: QueueRepair): Promise<void> {
    let technicians;
    try {
      technicians = await this.ops.listTechnicians();
    } catch (error) {
      return this.say(repairOpsErrorMessage(error), true);
    }
    if (technicians.length === 0) return this.say('No active technicians available.', true);

    const alert = await this.alerts.create({
      header: repair.technician_id ? 'Change technician' : 'Assign technician',
      inputs: technicians.map((technician) => ({
        type: 'radio' as const,
        label: technician.full_name,
        value: technician.id,
        checked: technician.id === repair.technician_id,
      })),
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Save', role: 'confirm' }],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    const chosen = technicians.find((technician) => technician.id === data?.values);
    if (role !== 'confirm' || !chosen) return;
    const assigned = await this.run(
      () => this.ops.assignTechnician(repair, chosen),
      `${chosen.full_name} assigned to ${shortRepairId(repair.id)}`,
    );
    if (assigned) await this.loadHistory(repair.id);
  }

  async addNote(repair: QueueRepair): Promise<void> {
    const alert = await this.alerts.create({
      header: `Add note to ${shortRepairId(repair.id)}`,
      inputs: [{ name: 'note', type: 'textarea', placeholder: 'Repair action, observation, test result, or instruction', attributes: { maxlength: 5000 } }],
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Save note', role: 'confirm' }],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    if (role !== 'confirm') return;
    await this.run(
      () => this.ops.addNote(repair.id, String(data?.values?.note ?? '')),
      'Repair note added',
    );
  }

  async reschedule(repair: QueueRepair): Promise<void> {
    const dateAlert = await this.alerts.create({
      header: `Reschedule ${shortRepairId(repair.id)}`,
      message: 'Choose a new date. Only available shop times will be offered.',
      inputs: [{
        name: 'date',
        type: 'date',
        min: new Date().toISOString().slice(0, 10),
        value: repair.booking_date,
      }],
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Choose time', role: 'confirm' }],
    });
    await dateAlert.present();
    const { role: dateRole, data: dateData } = await dateAlert.onDidDismiss();
    const bookingDate = String(dateData?.values?.date ?? '');
    if (dateRole !== 'confirm' || !bookingDate) return;

    let slots: string[];
    try {
      slots = await this.ops.availableSlots(repair, bookingDate);
    } catch (error) {
      return this.say(repairOpsErrorMessage(error), true);
    }
    if (slots.length === 0) return this.say('No available times for that date.', true);

    const timeAlert = await this.alerts.create({
      header: 'Choose an available time',
      inputs: slots.map((slot) => ({
        type: 'radio' as const,
        label: formatTime(slot),
        value: slot,
      })),
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Save schedule', role: 'confirm' }],
    });
    await timeAlert.present();
    const { role: timeRole, data: timeData } = await timeAlert.onDidDismiss();
    const bookingTime = slots.find((slot) => slot === timeData?.values);
    if (timeRole !== 'confirm' || !bookingTime) return;
    const rescheduled = await this.run(
      () => this.ops.reschedule(repair, bookingDate, bookingTime),
      `Repair rescheduled to ${bookingDate}, ${formatTime(bookingTime)}`,
    );
    if (rescheduled) await this.loadHistory(repair.id);
  }

  async openServiceLog(repair: QueueRepair): Promise<void> {
    const blocked = this.ops.serviceLogBlocked(repair);
    if (blocked) return this.say(blocked, true);
    const modal = await this.modals.create({
      component: ServiceLogModalComponent,
      componentProps: { repair },
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') await this.say(`Service action recorded for ${shortRepairId(repair.id)}`);
  }

  private async loadServiceLogs(repairId: string): Promise<void> {
    try {
      await this.ops.loadServiceLogs(repairId);
    } catch (error) {
      await this.say(repairOpsErrorMessage(error), true);
    }
  }

  private async loadHistory(repairId: string): Promise<void> {
    try {
      await this.ops.loadHistory(repairId);
    } catch (error) {
      await this.say(repairOpsErrorMessage(error), true);
    }
  }

  private compare(left: QueueRepair, right: QueueRepair): number {
    const key = this.sortKey();
    const leftValue = key === 'id' ? shortRepairId(left.id)
      : key === 'customer_name' ? left.customer_name
        : key === 'status' ? statusMeta(left.status).label
          : key === 'technician_name' ? left.technician_name ?? ''
            : left.booking_date;
    const rightValue = key === 'id' ? shortRepairId(right.id)
      : key === 'customer_name' ? right.customer_name
        : key === 'status' ? statusMeta(right.status).label
          : key === 'technician_name' ? right.technician_name ?? ''
            : right.booking_date;
    const result = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
    return this.sortAscending() ? result : -result;
  }

  private value(event: Event): string {
    const detailValue = (event as CustomEvent<{ value?: unknown }>).detail?.value;
    const targetValue = (event.target as HTMLInputElement | null)?.value;
    return String(detailValue ?? targetValue ?? '');
  }

  private async run(action: () => Promise<void>, success: string): Promise<boolean> {
    try {
      await action();
      await this.say(success);
      return true;
    } catch (error) {
      await this.say(repairOpsErrorMessage(error), true);
      return false;
    }
  }

  private async say(message: string, isError = false): Promise<void> {
    const toast = await this.toasts.create({
      message,
      duration: 2500,
      color: isError ? 'danger' : 'success',
      position: 'bottom',
    });
    await toast.present();
  }
}
