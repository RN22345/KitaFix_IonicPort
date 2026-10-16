import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonNote, IonRefresher,
  IonRefresherContent, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { StatusBadgeComponent, formatBookingDate, shortRepairId } from '@kitafix/booking';
import { QueueFilter } from '../../models/repair-ops.model';
import { RepairOpsService } from '../../services/repair-ops.service';

/** Screen 1 - Admin Portal: summary cards + the latest repairs. */
@Component({
  selector: 'app-admin-portal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonNote, IonRefresher,
    IonRefresherContent, IonSpinner, IonTitle, IonToolbar, StatusBadgeComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary"><ion-title>Admin Portal</ion-title></ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="cards">
        <ion-card button (click)="open('all')">
          <ion-card-content><span>All repairs</span><b>{{ counts().all }}</b></ion-card-content>
        </ion-card>
        <ion-card button (click)="open('waiting')">
          <ion-card-content><span>Pending</span><b>{{ counts().pending }}</b></ion-card-content>
        </ion-card>
        <ion-card button (click)="open('processed')">
          <ion-card-content><span>Confirmed</span><b>{{ counts().confirmed }}</b></ion-card-content>
        </ion-card>
      </div>

      @if (error(); as message) {
        <ion-note color="danger">{{ message }}</ion-note>
      }

      <h3>Latest repairs</h3>
      @if (loading()) {
        <div class="center"><ion-spinner name="crescent"></ion-spinner></div>
      } @else {
        @for (repair of latest(); track repair.id) {
          <ion-card>
            <ion-card-content class="row">
              <div>
                <strong>{{ id(repair.id) }}</strong> - {{ repair.customer_name }}<br />
                <ion-note>{{ repair.device_brand }} {{ repair.device_model }} · {{ date(repair.booking_date) }}</ion-note>
              </div>
              <app-status-badge [status]="repair.status"></app-status-badge>
            </ion-card-content>
          </ion-card>
        } @empty {
          <ion-note>No repairs yet.</ion-note>
        }
        <ion-button expand="block" (click)="open('all')">Open full Repair Queue</ion-button>
      }
    </ion-content>
  `,
  styles: [
    `
      :host {
        --kf-font: 'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif;
        --ion-color-primary: #0b5ed7;
        --ion-color-primary-rgb: 11, 94, 215;
        --ion-color-primary-contrast: #ffffff;
        --ion-color-primary-contrast-rgb: 255, 255, 255;
        --ion-color-primary-shade: #0a4cad;
        --ion-color-primary-tint: #2e7dff;
        font-family: var(--kf-font);
      }
      ion-title,
      ion-button,
      ion-card,
      ion-content,
      ion-note,
      ion-label,
      p,
      span,
      strong,
      b,
      .cards,
      .row,
      .center {
        font-family: var(--kf-font);
      }
      .cards { display: grid; grid-template-columns: repeat(3, 1fr); }
      .cards ion-card { margin: 4px; }
      .cards span { display: block; font-size: 0.75rem; color: var(--ion-color-medium); }
      .cards b { font-size: 1.8rem; color: var(--ion-color-primary); }
      .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .center { display: flex; justify-content: center; padding: 24px; }
    `,
  ],
})
export class AdminPortalPage implements OnInit {
  private readonly ops = inject(RepairOpsService);
  private readonly router = inject(Router);

  readonly counts = this.ops.counts;
  readonly loading = this.ops.loading;
  readonly error = this.ops.error;
  readonly id = shortRepairId;
  readonly date = formatBookingDate;

  latest() {
    return this.ops.repairs().slice(0, 5);
  }

  ngOnInit(): void {
    void this.ops.ensureLoaded();
  }

  open(filter: QueueFilter): void {
    this.ops.filter.set(filter);
    void this.router.navigate(['/tabs/repair-queue']);
  }

  async refresh(event: Event): Promise<void> {
    await this.ops.load();
    (event as CustomEvent).detail.complete();
  }
}
