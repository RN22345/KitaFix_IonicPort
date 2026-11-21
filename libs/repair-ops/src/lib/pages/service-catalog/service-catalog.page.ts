import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AlertController, IonButton, IonCard, IonCardContent, IonContent, IonFab, IonFabButton,
  IonHeader, IonIcon,   IonNote, IonRefresher, IonRefresherContent, IonSearchbar, IonSpinner, IonTitle,
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
    IonNote, IonRefresher, IonRefresherContent, IonSearchbar, IonSpinner, IonTitle, IonToggle, IonToolbar,
  ],
  templateUrl: './service-catalog.page.html',
  styleUrl: './service-catalog.page.scss',
})
export class ServiceCatalogPage implements OnInit {
  private readonly catalog = inject(ServiceCatalogService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly services = this.catalog.services;
  readonly loading = this.catalog.loading;
  readonly error = this.catalog.error;
  readonly currency = inject(REPAIR_OPS_CONFIG).currency;
  readonly search = signal('');
  readonly filteredServices = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    if (!query) return this.services();
    return this.services().filter((service) => (
      service.name.toLocaleLowerCase().includes(query)
      || (service.description ?? '').toLocaleLowerCase().includes(query)
    ));
  });

  ngOnInit(): void {
    void this.catalog.load();
  }

  async refresh(event: Event): Promise<void> {
    await this.catalog.load();
    (event as CustomEvent).detail.complete();
  }

  setSearch(event: Event): void {
    const detailValue = (event as CustomEvent<{ value?: unknown }>).detail?.value;
    const targetValue = (event.target as HTMLInputElement | null)?.value;
    this.search.set(String(detailValue ?? targetValue ?? ''));
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

  /** Add (service = null) or edit. Required: name, description, price and status. */
  async openForm(service: ServiceItem | null): Promise<void> {
    const alert = await this.alerts.create({
      header: service ? 'Edit service' : 'Add service',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Service name *', value: service?.name ?? '' },
        { name: 'description', type: 'textarea', placeholder: 'Description *', value: service?.description ?? '' },
        { name: 'price', type: 'number', placeholder: 'Price *', min: 0, value: service?.base_price ?? '' },
      ],
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Save', role: 'confirm' }],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    const statusAlert = await this.alerts.create({
      header: 'Choose service status',
      inputs: [
        { type: 'radio', label: 'Active', value: 'active', checked: service?.active ?? true },
        { type: 'radio', label: 'Inactive', value: 'inactive', checked: service ? !service.active : false },
      ],
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Continue', role: 'confirm' }],
    });
    await statusAlert.present();
    const { role: statusRole, data: statusData } = await statusAlert.onDidDismiss();
    if (statusRole !== 'confirm' || (statusData?.values !== 'active' && statusData?.values !== 'inactive')) return;

    const input: ServiceInput = {
      name: String(data.values.name ?? ''),
      description: String(data.values.description ?? '').trim(),
      base_price: Number(data.values.price),
      active: statusData.values === 'active',
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
