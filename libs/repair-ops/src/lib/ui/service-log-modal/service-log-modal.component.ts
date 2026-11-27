import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonNote, IonSelect, IonSelectOption,
  IonSpinner, IonTextarea, IonTitle, IonToolbar, ModalController,
} from '@ionic/angular';
import { shortRepairId } from '@kitafix/booking';
import { repairOpsErrorMessage } from '../../models/repair-ops-error';
import {
  QueueRepair, SERVICE_LOG_ACTIONS, ServiceLogAction, serviceLogInputProblem,
} from '../../models/repair-ops.model';
import { RepairOpsService } from '../../services/repair-ops.service';

/** `YYYY-MM-DDTHH:mm` in the device's local time, the format <input type="datetime-local"> uses. */
function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Service history entry form: WHAT the technician did, WHERE and WHEN, with details.
 * Opened from the Repair Queue with ModalController; closes itself after a
 * successful save (role 'saved') so the page can show its toast.
 */
@Component({
  selector: 'app-service-log-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton, IonButtons, IonContent, IonHeader, IonInput, IonNote, IonSelect,
    IonSelectOption, IonSpinner, IonTextarea, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Log service action</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()" [disabled]="saving()">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p class="summary">
        <strong>{{ shortId }}</strong> - {{ repair.device_brand }} {{ repair.device_model }}<br />
        <ion-note>Technician: {{ repair.technician_name ?? 'Assigned technician' }}</ion-note>
      </p>

      <ion-select
        label="Action performed"
        labelPlacement="stacked"
        interface="popover"
        [value]="action()"
        (ionChange)="action.set(readAction($event))"
      >
        @for (item of actions; track item.value) {
          <ion-select-option [value]="item.value">{{ item.label }}</ion-select-option>
        }
      </ion-select>

      <ion-input
        label="Where"
        labelPlacement="stacked"
        placeholder="Branch, bench or area where the work was done"
        maxlength="200"
        [value]="location()"
        (ionInput)="location.set(read($event))"
      ></ion-input>

      <ion-input
        type="datetime-local"
        label="When"
        labelPlacement="stacked"
        [max]="maxWhen"
        [value]="performedAt()"
        (ionInput)="performedAt.set(read($event))"
      ></ion-input>

      <ion-textarea
        label="Details"
        labelPlacement="stacked"
        placeholder="What was inspected, replaced, repaired or tested, and the result"
        rows="5"
        maxlength="5000"
        [counter]="true"
        [value]="details()"
        (ionInput)="details.set(read($event))"
      ></ion-textarea>

      @if (error(); as message) {
        <ion-note color="danger" class="error">{{ message }}</ion-note>
      }

      <ion-button expand="block" [disabled]="saving()" (click)="save()">
        @if (saving()) {
          <ion-spinner name="dots"></ion-spinner>
        } @else {
          Save to service history
        }
      </ion-button>
    </ion-content>
  `,
  styles: [
    `
      ion-select, ion-input, ion-textarea { margin-bottom: 14px; }
      .summary { margin: 0 0 16px; line-height: 1.5; }
      .error { display: block; margin-bottom: 12px; }
    `,
  ],
})
export class ServiceLogModalComponent implements OnInit {
  /** Set by ModalController (componentProps). */
  @Input({ required: true }) repair!: QueueRepair;

  private readonly modal = inject(ModalController);
  private readonly ops = inject(RepairOpsService);

  readonly actions = SERVICE_LOG_ACTIONS;
  readonly action = signal<ServiceLogAction>('repair');
  readonly location = signal('');
  readonly performedAt = signal(toLocalInput(new Date()));
  readonly details = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly maxWhen = toLocalInput(new Date(Date.now() + 5 * 60_000));

  get shortId(): string {
    return shortRepairId(this.repair.id);
  }

  ngOnInit(): void {
    // "Where" starts as the booking's branch; the technician can refine it (e.g. add the bench).
    this.location.set(this.repair.location);
  }

  read(event: Event): string {
    const detailValue = (event as CustomEvent<{ value?: unknown }>).detail?.value;
    const targetValue = (event.target as HTMLInputElement | null)?.value;
    return String(detailValue ?? targetValue ?? '');
  }

  readAction(event: Event): ServiceLogAction {
    const value = this.read(event);
    return SERVICE_LOG_ACTIONS.some((item) => item.value === value)
      ? value as ServiceLogAction
      : 'repair';
  }

  close(): void {
    void this.modal.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    const when = new Date(this.performedAt());
    const draft = {
      action_type: this.action(),
      location: this.location(),
      performed_at: Number.isNaN(when.getTime()) ? '' : when.toISOString(),
      details: this.details(),
    };
    const problem = serviceLogInputProblem({
      ...draft,
      repair_id: this.repair.id,
      technician_id: this.repair.technician_id ?? '',
    });
    if (problem) {
      this.error.set(problem);
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      const created = await this.ops.addServiceLog(this.repair, draft);
      await this.modal.dismiss(created, 'saved');
    } catch (error) {
      this.error.set(repairOpsErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
