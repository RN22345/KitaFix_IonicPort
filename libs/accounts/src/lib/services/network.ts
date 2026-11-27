import { Injectable, inject, signal } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Network } from '@capacitor/network';
import { cloudOfflineOutline, checkmarkCircleOutline } from 'ionicons/icons';

// Watches the internet connection and tells the user when it goes away or comes back
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private toastCtrl = inject(ToastController);

  readonly online = signal(true); // other pages can read this too
  private offlineToast?: HTMLIonToastElement;
  private started = false;

  // Call this one time when the app starts
  async start() {
    if (this.started) return;
    this.started = true;

    // The app may be opened while there is already no connection
    const status = await Network.getStatus();
    if (!status.connected) await this.goOffline();

    // Runs every time the connection changes
    await Network.addListener('networkStatusChange', (change) => {
      if (change.connected) void this.goOnline();
      else void this.goOffline();
    });
  }

  private async goOffline() {
    this.online.set(false);
    if (this.offlineToast) return; // already showing

    const toast = await this.toastCtrl.create({
      message: "You're offline. Check your internet connection.",
      icon: cloudOfflineOutline,
      position: 'top',
      cssClass: 'kf-toast kf-toast--offline',
      // no duration: it stays until the connection is back or the user taps OK
      buttons: [{ text: 'OK', role: 'cancel' }],
    });

    this.offlineToast = toast;
    toast.onDidDismiss().then(() => {
      if (this.offlineToast === toast) this.offlineToast = undefined;
    });

    await toast.present();

    // The connection may have come back while the toast was opening
    if (this.online()) await toast.dismiss();
  }

  private async goOnline() {
    const wasOffline = !this.online();
    this.online.set(true);

    // Remove the "offline" toast
    if (this.offlineToast) {
      await this.offlineToast.dismiss();
      this.offlineToast = undefined;
    }

    // Wi-Fi to mobile data also fires this event, so only say it when we were really offline
    if (!wasOffline) return;

    const toast = await this.toastCtrl.create({
      message: 'Back online.',
      icon: checkmarkCircleOutline,
      position: 'top',
      cssClass: 'kf-toast kf-toast--online',
      duration: 2500,
    });
    await toast.present();
  }
}