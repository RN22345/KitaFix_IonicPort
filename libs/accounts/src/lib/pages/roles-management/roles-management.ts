import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { RoleInfo } from '../../models/account.model';
import { AccountsService } from '../../services/accounts';

@Component({
  selector: 'app-roles-management',
  templateUrl: './roles-management.html',
  styleUrl: '../../styles/accounts.scss',
  standalone: true,
  imports: [IonContent, IonIcon, RouterLink],
})
export class RolesManagementPage {
  private accountsService = inject(AccountsService);

  roles = this.accountsService.getRoles();

  // "1 account" or "2 accounts"
  accountCountText(role: RoleInfo): string {
    const count = this.accountsService.countByRole(role.key);
    return count + (count === 1 ? ' account' : ' accounts');
  }
}