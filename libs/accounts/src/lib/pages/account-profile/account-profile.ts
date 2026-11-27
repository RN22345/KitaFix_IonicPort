import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner  } from '@ionic/angular';
import { ALL_PERMISSIONS, Role, GENDER_NAMES } from '../../models/account.model';
import { AccountsService, AdminAccount } from '../../services/accounts';
import { AccountIdPipe, formatAccountId } from '../../pipes/account-id.pipe';
import { copyOutline } from 'ionicons/icons';
import { ClipboardService } from '../../services/clipboard';

@Component({
  selector: 'app-account-profile',
  templateUrl: './account-profile.html',
  styleUrl: '../../styles/accounts.scss',
  standalone: true,
  imports: [IonContent, IonIcon, IonSpinner, DatePipe, AccountIdPipe],
})
export class AccountProfilePage {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private clipboard = inject(ClipboardService);
  readonly copyIcon = copyOutline; // the icon data itself, so no registration is needed

  copyAccountId(account: AdminAccount) {
    const text = formatAccountId(account.role, account.accountNo);
    if (text) void this.clipboard.copy(text, 'Account ID copied.');
  }
  accountsService = inject(AccountsService);

  ionViewWillEnter() {
    this.pictureState = {};
    this.accountId = this.route.snapshot.paramMap.get('id') ?? '';
    this.showRoleSheet = false;
    this.showStatusDialog = false;
    this.roleError.set('');
    this.statusError.set('');
    this.pendingActive = null;
    this.showAvatar.set(false);
    if (this.accountId) void this.accountsService.loadAccounts(this.accountId);
    else this.accountsService.clear();
  }

  // The UUID comes from the existing route.
  accountId = this.route.snapshot.paramMap.get('id') ?? '';

  allPermissions = ALL_PERMISSIONS;
  genderNames = GENDER_NAMES;
  roles = this.accountsService.getRoles();

  // For each account id: did its profile picture load, or fail (the account has no picture)?
  pictureState: Record<string, 'loaded' | 'failed'> = {};

  showRoleSheet = false; // the "Assign role" box
  showStatusDialog = false; // the "Deactivate / Activate?" box
  selectedRole: Role | null = null;
  readonly savingRole = signal(false);
  readonly roleError = signal('');
  readonly savingStatus = signal(false);
  readonly statusError = signal('');
  showAvatar = signal(false); // shows the big picture
  private pendingActive: boolean | null = null;

  // The account being shown (read again each time, so changes show up right away)
  get account(): AdminAccount | undefined {
    return this.accountsService.getAccountById(this.accountId);
  }

  // True until the account has been requested and finished loading
  get isLoading(): boolean {
    return !!this.accountId &&
      (this.accountsService.loading || this.accountsService.loadPhase === 'idle');
  }

  // The role picked inside the "Assign role" box
  get selectedRoleInfo() {
    return this.accountsService.getRole(this.selectedRole);
  }

  // Only opens when the picture has really loaded (the account has one)
  openAvatar(id: string) {
    if (this.pictureState[id] === 'loaded') this.showAvatar.set(true);
  }

  // True if the account's role is allowed to do this permission
  isAllowed(account: AdminAccount, permission: string): boolean {
    return this.accountsService.getRole(account.role).permissions.includes(permission);
  }

  goBack() {
    this.router.navigate(['/accounts-list']);
  }

  // "Change role" button
  openRoleSheet(account: AdminAccount) {
    if (!this.accountsService.canAssignRole(account) || this.savingRole() || this.savingStatus()) return;
    this.roleError.set('');
    this.selectedRole = this.roles.some(role => role.key === account.role) ? account.role as Role : null;
    this.showRoleSheet = true;
  }

  // Tapping outside the "Assign role" box closes it (not while it is saving)
  closeRoleSheet() {
    if (!this.savingRole()) this.showRoleSheet = false;
  }

  // "Save role" button
  async saveRole() {
    if (this.savingRole() || this.savingStatus() || !this.selectedRole) return;
    const id = this.accountId;
    this.savingRole.set(true);
    this.roleError.set('');
    try {
      await this.accountsService.assignRole(id, this.selectedRole);
      if (this.accountId !== id) return;
      this.showRoleSheet = false;
      await this.accountsService.loadAccounts(id);
    } catch (error) {
      if (this.accountId === id) this.roleError.set(error instanceof Error ? error.message : 'Role could not be saved. Please retry.');
    } finally {
      this.savingRole.set(false);
    }
  }

  openStatusDialog(account: AdminAccount) {
    if (!this.accountsService.canChangeStatus(account) || this.savingRole() || this.savingStatus()) return;
    this.pendingActive = !account.isActive;
    this.statusError.set('');
    this.showStatusDialog = true;
  }

  // "Yes" in the existing confirmation box.
  async confirmStatusChange(account: AdminAccount) {
    if (!this.showStatusDialog || this.pendingActive === null || this.savingStatus() || this.savingRole()
      || account.id !== this.accountId || !this.accountsService.canChangeStatus(account)) return;
    const id = this.accountId;
    const active = this.pendingActive;
    this.savingStatus.set(true);
    this.statusError.set('');
    try {
      await this.accountsService.setActive(id, active);
      if (this.accountId !== id) return;
      this.showStatusDialog = false;
      this.pendingActive = null;
      await this.accountsService.reloadAccountViews(id);
    } catch (error) {
      if (this.accountId === id) this.statusError.set(error instanceof Error ? error.message : 'Status could not be saved. Please retry.');
    } finally {
      this.savingStatus.set(false);
    }
  }
}