import { Injectable, inject, signal } from '@angular/core';
import { Account, Role, RoleInfo } from '../models/account.model';
import { ACCOUNTS_AUTH_CLIENT } from './accounts-auth';

export interface AdminAccount extends Omit<Account, 'role' | 'isActive'> {
  role: string | null;
  isActive: boolean | null;
  profileMissing: boolean;
  address: string;
}
export function mapAdminAccount(row: Record<string, unknown>): AdminAccount {
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  const firstName = text(row['first_name']).trim();
  const lastName = text(row['last_name']).trim();
  return {
    id: text(row['id']), firstName: firstName || (!lastName ? text(row['full_name']).trim() : ''),
    accountNo: text(row['account_no']),
    lastName, email: text(row['email']),
    contactNo: text(row['contact_no']),
    address: text(row['address']),
    birthday: text(row['birthday']),
    gender: text(row['gender']),
    joinedDate: text(row['joined_at']),
    role: typeof row['role'] === 'string' ? row['role'] : null,
    isActive: typeof row['active'] === 'boolean' ? row['active'] : null,
    profileMissing: row['profile_exists'] !== true,
  };
}

// Everything the admin pages need: the list of accounts and the list of roles
@Injectable({ providedIn: 'root' })
export class AccountsService {
  // Static role descriptions; account identities and assignments come only from the RPC.
  private roles: RoleInfo[] = [
    {
      key: 'admin',
      name: 'Admin',
      description: 'Full control of accounts, roles and reports',
      permissions: [
        'Manage accounts',
        'Manage roles',
        'Schedule appointments',
        'Track repair status',
        'Manage technicians',
        'Register devices',
        'View service history',
        'View reports',
      ],
    },
    {
      key: 'technician',
      name: 'Technician',
      description: 'Handles assigned repairs and updates status',
      permissions: ['Schedule appointments', 'Track repair status', 'View service history'],
    },
    {
      key: 'customer',
      name: 'Customer',
      description: 'Books repairs and tracks own devices',
      permissions: ['Schedule appointments', 'Track repair status', 'Register devices', 'View service history'],
    },
  ];

  private readonly client = inject(ACCOUNTS_AUTH_CLIENT);
  private readonly state = signal({
    accounts: [] as AdminAccount[],
    detail: undefined as AdminAccount | undefined,
    loading: false,
    error: '',
    phase: 'idle' as 'idle' | 'session' | 'rpc' | 'ready' | 'error',
  });
  private avatarVersion = Date.now();
  private generation = 0;
  private userId: string | null | undefined;
  private requestController?: AbortController;
  private roleController?: AbortController;
  private statusController?: AbortController;

  get loading() { return this.state().loading; }
  get error() { return this.state().error; }
  // Safe diagnostics: no identities, session objects, credentials or payloads.
  get loadPhase() { return this.state().phase; }

  constructor() {
    // Supabase awaits callbacks. Keep this synchronous and never call Auth/RPC
    // here. INITIAL_SESSION and same-user refresh/focus events are not switches.
    this.client.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user.id ?? null;
      if (event === 'SIGNED_OUT' || (this.userId !== undefined && nextId !== this.userId)) {
        this.clear();
      }
      this.userId = nextId;
    });
  }

  clear() {
    this.generation++;
    this.requestController?.abort();
    this.roleController?.abort();
    this.statusController?.abort();
    this.requestController = undefined;
    this.state.set({ accounts: [], detail: undefined, loading: false, error: '', phase: 'idle' });
  }

  async loadAccounts(id?: string): Promise<void> {
    this.avatarVersion = Date.now();
    this.clear();
    const generation = this.generation;
    const controller = new AbortController();
    this.requestController = controller;
    const current = () => generation === this.generation && !controller.signal.aborted;
    this.state.update(state => ({ ...state, loading: true, phase: 'session' }));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      // Bound the complete operation, including SDK initialization/lock waits
      // before fetch is sent (which an HTTP AbortSignal alone cannot bound).
      await Promise.race([
        (async () => {
          const { data, error } = await this.client.auth.getSession();
          if (!current()) return;
          if (error) throw error;
          if (!data.session) throw new Error('missing_session');
          this.userId = data.session.user.id;
          this.state.update(state => ({ ...state, phase: 'rpc' }));
          const accounts: AdminAccount[] = [];
          const pageSize = 500;
          for (let offset = 0; ; offset += pageSize) {
            const { data, error } = await this.client.rpc('admin_read_accounts', { account_id: id ?? null })
              .range(offset, offset + pageSize - 1).abortSignal(controller.signal);
            if (!current()) return;
            if (error) throw error;
            if (!Array.isArray(data)) throw new Error('Invalid account response');
            accounts.push(...data.map(mapAdminAccount));
            if (data.length < pageSize) break;
          }
          this.state.update(state => ({ ...state,
            accounts: id ? [] : accounts,
            detail: id ? accounts.find(account => account.id === id) : undefined,
            phase: 'ready',
          }));
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            reject(new Error('accounts_timeout'));
          }, 20000);
        }),
      ]);
    } catch (error) {
      if (generation === this.generation) {
        const phase = this.loadPhase;
        controller.abort();
        const code = (error as { code?: string } | null)?.code;
        const message = timedOut
          ? (phase === 'session'
            ? 'Sign-in initialization timed out. Please retry or sign in again.'
            : 'The accounts request timed out. Check your connection and retry.')
          : phase === 'session'
            ? 'Your sign-in session could not be loaded. Please sign in again.'
            : code === '42501'
              ? 'Accounts access was denied. An active Admin account is required.'
              : 'Accounts could not be loaded. Check your Admin access and connection, then retry.';
        this.state.update(state => ({ ...state, error: message, phase: 'error' }));
      }
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (generation === this.generation) {
        this.requestController = undefined;
        this.state.update(state => ({ ...state, loading: false }));
      }
    }
  }

  // ----- Roles -----

  canAssignRole(account: AdminAccount): boolean {
    return !!this.userId && account.id !== this.userId && !account.profileMissing;
  }

  async assignRole(id: string, role: Role): Promise<void> {
    const account = this.getAccountById(id);
    if (!account || !this.canAssignRole(account)) {
      throw new Error('Choose another account with an existing profile. You cannot change your own role.');
    }
    if (!this.roles.some(value => value.key === role)) throw new Error('Choose a valid role.');
    if (this.roleController || this.statusController) throw new Error('An account update is already in progress.');
    const generation = this.generation;
    const controller = new AbortController();
    this.roleController = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { data, error } = await Promise.race([
        Promise.resolve().then(() => this.client.rpc('admin_assign_account_role', { account_id: id, new_role: role })
          .abortSignal(controller.signal)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('The save result is unknown. Refresh the account before trying again.'));
          }, 20000);
        }),
      ]).catch(() => {
        throw new Error('The save result is unknown. Refresh the account before trying again.');
      });
      if (generation !== this.generation) throw new Error('Account context changed. Reopen the account before trying again.');
      if (error) {
        if (error.code === '42501') throw new Error('Role change denied. Active Admin access is required and you cannot change your own role.');
        if (error.code === 'PGRST202') throw new Error('Role assignment is not available yet. The administrator must deploy the role assignment migration.');
        if (error.code === 'P0002') throw new Error('The account or profile no longer exists. Refresh the account.');
        throw new Error('The save result could not be confirmed. Refresh the account before trying again.');
      }
      if (data !== role) throw new Error('The saved role could not be confirmed. Refresh the account.');
      // Do not simulate persistence. The page reloads the actual backend record.
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (this.roleController === controller) this.roleController = undefined;
    }
  }

  getRoles(): RoleInfo[] {
    return this.roles;
  }

  canChangeStatus(account: AdminAccount): boolean {
    return this.canAssignRole(account) && typeof account.isActive === 'boolean';
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const account = this.getAccountById(id);
    if (!account || !this.canChangeStatus(account)) {
      throw new Error('Choose another account with a profile and known status. You cannot change your own active status.');
    }
    if (typeof active !== 'boolean') throw new Error('Choose a valid active status.');
    if (this.roleController || this.statusController) throw new Error('An account update is already in progress.');
    const generation = this.generation;
    const controller = new AbortController();
    this.statusController = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { data, error } = await Promise.race([
        Promise.resolve().then(() => this.client.rpc('admin_set_account_active', { account_id: id, new_active: active })
          .abortSignal(controller.signal)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Status save timed out'));
          }, 20000);
        }),
      ]).catch(() => {
        throw new Error('The status save result is unknown. Refresh the account before trying again.');
      });
      if (generation !== this.generation) throw new Error('Account context changed. Reopen the account before trying again.');
      if (error) {
        if (error.code === '42501') throw new Error('Status change denied. Active Admin access is required and you cannot change your own active status.');
        if (error.code === 'PGRST202') throw new Error('Account status changes are not available yet. Contact the administrator.');
        if (error.code === 'P0002') throw new Error('The account or profile no longer exists. Refresh the account.');
        throw new Error('The status save result could not be confirmed. Refresh the account before trying again.');
      }
      if (data !== active) throw new Error('The saved status could not be confirmed. Refresh the account.');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (this.statusController === controller) this.statusController = undefined;
    }
  }

  async reloadAccountViews(id: string): Promise<void> {
    // One fresh list read supplies both the detail and the list/counts. No
    // optimistic status mutation or cached record is presented as persistence.
    await this.loadAccounts();
    if (this.error) return;
    this.state.update(state => ({ ...state, detail: state.accounts.find(account => account.id === id) }));
  }

  getRole(key: string | null): RoleInfo {
    return this.roles.find((role) => role.key === key) ?? {
      key: key as Role, name: key || 'Role unavailable',
      description: 'No configured permission details available.', permissions: [],
    };
  }

  // How many accounts have this role
  countByRole(key: Role): number {
    return this.state().accounts.filter((account) => account.role === key).length;
  }

  // ----- Accounts -----

  getAccounts(): AdminAccount[] {
    return this.state().accounts;
  }

  getAccountById(id: string): AdminAccount | undefined {
    const detail = this.state().detail;
    return detail?.id === id ? detail : undefined;
  }

  // ----- Small helpers for showing accounts -----

  // "Paolo Dizon" -> "PD"
  getInitials(account: Pick<Account, 'firstName' | 'lastName'>): string {
    return ((account.firstName[0] || '') + (account.lastName[0] || '')).toUpperCase() || '?';
  }

  // Every account gets one of these colors for its initials box
  getAvatarColor(account: Pick<Account, 'id'>): string {
    const colors = ['#0B5ED7', '#2E7DFF', '#0F172A', '#0A8F8B', '#5C7CCF'];

    // The id is text, so add up its letters to get a number
    let total = 0;
    for (const letter of account.id) total += letter.charCodeAt(0);

    return colors[total % colors.length];
  }

  // The public link of an account's profile picture.
  // The account may not have uploaded one, so the page falls back to the initials.
  getAvatarUrl(account: Pick<Account, 'id'>): string {
    const url = this.client.storage.from('avatars').getPublicUrl(`${account.id}/avatar`).data.publicUrl;
    return `${url}?v=${this.avatarVersion}`;
  }
}
