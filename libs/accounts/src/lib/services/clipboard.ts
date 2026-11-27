import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { alertCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';

// Copies text to the clipboard and tells the user if it worked
@Injectable({ providedIn: 'root' })
export class ClipboardService {
  private toastCtrl = inject(ToastController);
  private toast?: HTMLIonToastElement;

  async copy(text: string, message = 'Copied to clipboard.') {
    const copied = await this.writeText(text);

    // Remove the previous toast, so quick taps don't stack up
    await this.toast?.dismiss();

    this.toast = await this.toastCtrl.create({
      message: copied ? message : 'Could not copy. Please try again.',
      icon: copied ? checkmarkCircleOutline : alertCircleOutline,
      position: 'top',
      cssClass: copied ? 'kf-toast kf-toast--online' : 'kf-toast kf-toast--offline',
      duration: 2000,
    });
    await this.toast.present();
  }

  private async writeText(text: string): Promise<boolean> {
    // The modern way (needs a secure page, which the app has)
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to the older way below
    }

    // The older way: copy from a hidden text box
    try {
      const box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(box);
      return ok;
    } catch {
      return false;
    }
  }
}