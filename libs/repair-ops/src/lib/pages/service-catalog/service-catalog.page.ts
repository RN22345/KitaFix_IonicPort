import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import {
  AlertController, IonButton, IonCard, IonCardContent, IonContent, IonFab, IonFabButton,
  IonHeader, IonIcon, IonNote, IonRefresher, IonRefresherContent, IonSpinner, IonTitle,
  IonToggle, IonToolbar, ToastController,
} from '@ionic/angular';
import { REPAIR_OPS_CONFIG } from '../../data-access/config';
import { repairOpsErrorMessage } from '../../models/repair-ops-error';
import { ServiceInput, ServiceItem } from '../../models/repair-ops.model';
import { ServiceCatalogService } from '../../services/service-catalog.service';

/** Screen 3 - Service Catalog: add, edit, turn a service on or off. */
@Component({
  selector: 'app-service-catalog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton, IonCard, IonCardContent, IonContent, IonFab, IonFabButton, IonHeader, IonIcon,
    IonNote, IonRefresher, IonRefresherContent, IonSpinner, IonTitle, IonToggle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary"><ion-title>Service Catalog</ion-title></ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (error(); as message) {
        <ion-note color="danger">{{ message }}</ion-note>
      }

      @if (loading()) {
        <div class="center"><ion-spinner name="crescent"></ion-spinner></div>
      } @else {
        @for (service of services(); track service.id) {
          <ion-card [class.off]="!service.active">
            <ion-card-content>
              <div class="head">
                <strong>{{ service.name }}</strong>
                <span class="price">{{ currency }}{{ service.base_price }}</span>
              </div>
              <ion-note>{{ service.description || 'No description' }}</ion-note>
              <div class="actions">
                <ion-toggle
                  [checked]="service.active"
                  (ionChange)="toggle(service, $event)"
                >{{ service.active ? 'Active' : 'Inactive' }}</ion-toggle>
                <ion-button size="small" fill="outline" (click)="openForm(service)">Edit</ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        } @empty {
          <p class="empty">No services yet. Tap + to add one.</p>
        }
      }

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="openForm(null)"><ion-icon name="add-circle-outline"></ion-icon></ion-fab-button>
      </ion-fab>
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
      .head,
      .price,
      .actions,
      .empty {
        font-family: var(--kf-font);
      }
      .head { display: flex; justify-content: space-between; }
      .price { font-weight: 600; color: var(--ion-color-primary); }
      .actions { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
      .off { opacity: 0.6; }
      .center { display: flex; justify-content: center; padding: 24px; }
      .empty { text-align: center; color: var(--ion-color-medium); padding: 24px; }
    `,
  ],
})
export class ServiceCatalogPage implements OnInit {
  private readonly catalog = inject(ServiceCatalogService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly services = this.catalog.services;
  readonly loading = this.catalog.loading;
  readonly error = this.catalog.error;
  readonly currency = inject(REPAIR_OPS_CONFIG).currency;

  ngOnInit(): void {
    void this.catalog.load();
  }

  async refresh(event: Event): Promise<void> {
    await this.catalog.load();
    (event as CustomEvent).detail.complete();
  }

  async toggle(service: ServiceItem, event: Event): Promise<void> {
    const active = (event as CustomEvent).detail.checked as boolean;
    if (active === service.active) return;
    try {
      await this.catalog.setActive(service.id, active);
      await this.say(active ? `${service.name} turned on` : `${service.name} turned off for new bookings`);
    } catch (error) {
      await this.say(repairOpsErrorMessage(error), true);
      await this.catalog.load();
    }
  }

  /** Add (service = null) or edit. Required: name and price. */
  async openForm(service: ServiceItem | null): Promise<void> {
    const alert = await this.alerts.create({
      header: service ? 'Edit service' : 'Add service',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Service name *', value: service?.name ?? '' },
        { name: 'description', type: 'textarea', placeholder: 'Description', value: service?.description ?? '' },
        { name: 'price', type: 'number', placeholder: 'Price *', min: 0, value: service?.base_price ?? '' },
      ],
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Save', role: 'confirm' }],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    const input: ServiceInput = {
      name: String(data.values.name ?? ''),
      description: String(data.values.description ?? '').trim() || null,
      base_price: Number(data.values.price),
      active: service?.active ?? true,
    };
    try {
      if (service) await this.catalog.edit(service.id, input);
      else await this.catalog.add(input);
      await this.say('Service saved');
    } catch (error) {
      await this.say(repairOpsErrorMessage(error), true);
    }
  }

  private async say(message: string, isError = false): Promise<void> {
    const toast = await this.toasts.create({
      message, duration: 2500, color: isError ? 'danger' : 'success', position: 'bottom',
    });
    await toast.present();
  }
}
