import { Component, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent
} from '@ionic/angular';
import { Role } from '../../models/account.model';
import { AccountsService, AdminAccount } from '../../services/accounts';
import { AccountIdPipe, formatAccountId } from '../../pipes/account-id.pipe';

@Component({
  selector: 'app-accounts-list',
  templateUrl: './accounts-list.html',
  styleUrl: '../../styles/accounts.scss',
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    RouterLink,
    AccountIdPipe,
  ],
})
export class AccountsListPage {
  accountsService = inject(AccountsService);
  roles = this.accountsService.getRoles();

  // Used to scroll back to the top when the page changes
  @ViewChild(IonContent) content?: IonContent;

  // For each account id: did its profile picture load, or fail (the account has no picture)?
  pictureState: Record<string, 'loaded' | 'failed'> = {};

  ionViewWillEnter() {
    this.pictureState = {};
    this.resetPaging();
    void this.accountsService.loadAccounts();
  }

  refreshAccounts() {
    if (this.accountsService.loading) return;
    this.pictureState = {};
    this.resetPaging();
    void this.accountsService.loadAccounts();
  }

  async handleRefresh(event: CustomEvent) {
    try {
      this.pictureState = {};
      this.resetPaging();
      await this.accountsService.loadAccounts();
    } finally {
      (event.target as HTMLIonRefresherElement).complete();
    }
  }

  // What the admin typed / picked to narrow the list
  search = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  roleFilter: 'all' | Role = 'all';

  // How the list is ordered
  sortBy: 'newest' | 'oldest' | 'first-name' | 'last-name' = 'newest';

  // Pagination: 10 accounts per page
  readonly pageSize = 10;
  readonly currentPage = signal(1);

  get accounts(): AdminAccount[] {
    return this.accountsService.getAccounts();
  }

  get activeCount(): number {
    return this.accounts.filter((account) => account.isActive).length;
  }

  get inactiveCount(): number {
    return this.accounts.filter(account => account.isActive === false).length;
  }

  // The accounts that match the search box, the status and the role, in the chosen order
  get filteredAccounts(): AdminAccount[] {
    const text = this.search.trim().toLowerCase();

    const matches = this.accounts.filter((account) => {
      const fullName = (account.firstName + ' ' + account.lastName).toLowerCase();
      const accountId = formatAccountId(account.role, account.accountNo).toLowerCase();
      const matchesSearch = fullName.includes(text) || account.email.toLowerCase().includes(text) || accountId.includes(text);

      let matchesStatus = true;
      if (this.statusFilter === 'active') matchesStatus = account.isActive === true;
      if (this.statusFilter === 'inactive') matchesStatus = account.isActive === false;

      const matchesRole = this.roleFilter === 'all' || account.role === this.roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });

    return this.sortAccounts(matches);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredAccounts.length / this.pageSize));
  }

  // The page being shown (never past the last page, even if the list gets shorter)
  get page(): number {
    return Math.min(this.currentPage(), this.totalPages);
  }

  // Only the accounts of the current page
  get visibleAccounts(): AdminAccount[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredAccounts.slice(start, start + this.pageSize);
  }

  // "Showing 11-20 of 34"
  get rangeText(): string {
    const total = this.filteredAccounts.length;
    if (!total) return '';
    const start = (this.page - 1) * this.pageSize + 1;
    const end = Math.min(this.page * this.pageSize, total);
    return `Showing ${start}-${end} of ${total}`;
  }

  // The page buttons: 1 2 3 ... 9 10 (with dots when there are many pages)
  get pageItems(): (number | string)[] {
    const total = this.totalPages;
    const page = this.page;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const items: (number | string)[] = [1];
    const from = Math.max(2, page - 1);
    const to = Math.min(total - 1, page + 1);
    if (from > 2) items.push('…');
    for (let n = from; n <= to; n++) items.push(n);
    if (to < total - 1) items.push('…');
    items.push(total);
    return items;
  }

  goToPage(target: number | string) {
    if (typeof target !== 'number') return;
    const next = Math.min(Math.max(1, target), this.totalPages);
    if (next === this.page) return;
    this.currentPage.set(next);
    void this.content?.scrollToTop(200);
  }

  private sortAccounts(list: AdminAccount[]): AdminAccount[] {
    const sorted = [...list];
    const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    const byDate = (a: AdminAccount, b: AdminAccount) =>
      (Date.parse(a.joinedDate) || 0) - (Date.parse(b.joinedDate) || 0);

    if (this.sortBy === 'newest') sorted.sort((a, b) => byDate(b, a));
    else if (this.sortBy === 'oldest') sorted.sort(byDate);
    else if (this.sortBy === 'first-name') {
      sorted.sort((a, b) => byText(a.firstName, b.firstName) || byText(a.lastName, b.lastName));
    } else {
      sorted.sort((a, b) => byText(a.lastName, b.lastName) || byText(a.firstName, b.firstName));
    }
    return sorted;
  }

  // Runs every time the admin types in the search box
  onSearch(event: Event) {
    this.search = (event.target as HTMLInputElement).value;
    this.resetPaging();
  }

  // Runs when the admin picks a role in the dropdown
  onRoleChange(event: Event) {
    this.roleFilter = (event.target as HTMLSelectElement).value as 'all' | Role;
    this.resetPaging();
  }

  // Runs when the admin picks how to order the list
  onSortChange(event: Event) {
    this.sortBy = (event.target as HTMLSelectElement).value as typeof this.sortBy;
    this.resetPaging();
  }

  // Runs when the admin taps All / Active / Inactive
  setStatus(status: 'all' | 'active' | 'inactive') {
    this.statusFilter = status;
    this.resetPaging();
  }

  // Go back to page 1 whenever the list changes
  private resetPaging() {
    this.currentPage.set(1);
  }
}