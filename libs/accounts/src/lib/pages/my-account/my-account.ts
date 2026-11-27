import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { GENDER_NAMES } from '../../models/account.model';
import { ProfileService } from '../../services/profile';
import { AccountsAuthService, authMessage } from '../../services/accounts-auth';
import { AccountIdPipe, formatAccountId } from '../../pipes/account-id.pipe';
import { ClipboardService } from '../../services/clipboard';
import { copyOutline } from 'ionicons/icons'

@Component({
  selector: 'app-my-account',
  templateUrl: './my-account.html',
  styleUrl: '../../styles/accounts.scss',
  standalone: true,
  imports: [IonContent, IonIcon, RouterLink, TitleCasePipe, DatePipe],
})
export class MyAccountPage {
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private clipboard = inject(ClipboardService);
  readonly copyIcon = copyOutline; // the icon data itself, so no registration is needed

  // The ID as shown on the page, e.g. "CS-26111543"
  get accountIdText(): string {
    return formatAccountId(this.auth.account?.role, this.profile.accountNo);
  }

  copyAccountId() {
    if (this.accountIdText) void this.clipboard.copy(this.accountIdText, 'Account ID copied.');
  }
  readonly auth = inject(AccountsAuthService);
  logoutError = '';
  loggingOut = false;
  showDeactivate = signal(false); // shows the "Deactivate account?" box
  deactivating = signal(false);
  deactivateError = signal('');
  showAvatar = signal(false); // shows the big picture
  deactivateWord = signal(''); // what the user typed in the confirm box

  openAvatar() {
    if (this.profile.profilePictureUrl) this.showAvatar.set(true);
  }
  closeAvatar() {
    this.showAvatar.set(false);
  }

  genderNames = GENDER_NAMES;

  // The current profile (read again each time, so edits show up right away)
  get profile() {
    return this.profileService.profile;
  }

  get fullName(): string {
    return (this.profile.firstName + ' ' + this.profile.lastName).trim() || 'Name not provided';
  }

  // The button only works after the user types the word exactly
  get canDeactivate(): boolean {
    return this.deactivateWord().trim().toUpperCase() === 'DEACTIVATE';
  }

  // Log out button
  async logout() {
    if (this.loggingOut) return;
    this.loggingOut = true;
    this.logoutError = '';
    try {
      if (!navigator.onLine) {
        this.logoutError = "You're offline. Connect to the internet to log out.";
        return;
      }
      await this.auth.logout();
      await this.router.navigate(['/accounts-login'], { replaceUrl: true });
      // Merged app: other teams keep the old user's data in memory. Start fresh,
      // as Team 2's sign-out does.
      window.location.reload();
    } catch (error) {
      this.logoutError = authMessage(error);
    } finally {
      this.loggingOut = false;
    }
  }

  openDeactivate() {
    this.deactivateError.set('');
    this.deactivateWord.set('');
    this.showDeactivate.set(true);
  }

  onDeactivateWord(event: Event) {
    this.deactivateWord.set((event.target as HTMLInputElement).value);
  }

  // "Deactivate" inside the box
  async confirmDeactivate() {
    if (this.deactivating() || !this.canDeactivate) return;
    this.deactivating.set(true);
    this.deactivateError.set('');

    try {
      await this.auth.deactivateOwnAccount();
      this.showDeactivate.set(false);
      await this.router.navigate(['/accounts-login'], { replaceUrl: true });
    } catch (error) {
      this.deactivateError.set(error instanceof Error ? error.message : authMessage(error));
    } finally {
      this.deactivating.set(false);
    }
  }

  showLogout = signal(false); // shows the "Log out?" box

  openLogout() {
    this.showLogout.set(true);
  }

  // "Log out" inside the box: closes the box, then logs out
  async confirmLogout() {
    this.showLogout.set(false);
    await this.logout();
  }
}
