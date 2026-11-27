import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseClient } from '@supabase/supabase-js';
import { timeLoginStage } from './login-timing';
import type { Role } from '../models/account.model';
import { ProfileChanges, ProfileService } from './profile';

export const ACCOUNTS_AUTH_CLIENT =
  new InjectionToken<SupabaseClient>('ACCOUNTS_AUTH_CLIENT');

export type AccountRole = Role;

export function accountLoginDestination(role: AccountRole): string {
  // Merged app: customers land on Team 2's booking tabs, admins on Team 4's
  // Overview, technicians on Team 3's repair queue.
  if (role === 'customer') return '/tabs';
  if (role === 'admin') return '/admin';
  if (role === 'technician') return '/ops/repair-queue';
  throw new Error('Your account role is invalid. Contact the administrator.');
}

export function authMessage(error: unknown): string {
  const value = error as {
    code?: string;
    message?: string;
  } | null;

  if (value?.code === 'invalid_credentials') {
    return 'Unable to log in. Check your email and password. If you don’t have an account yet, sign up.';
  }

  if (value?.code === 'otp_expired') {
    return 'Incorrect or expired code. Please try again or request a new code.';
  }

  if (value?.code === 'user_already_exists' || value?.code === 'email_exists') {
    return 'This email is already registered. Log in or use a different email.';
  }

  return value?.message ||
    'The request failed. Check your connection and try again.';
}

@Injectable({ providedIn: 'root' })
export class AccountsAuthService {
  private readonly client = inject(ACCOUNTS_AUTH_CLIENT);
  private readonly profile = inject(ProfileService);
  private readonly accountState = signal<{ email: string; role: AccountRole } | null>(null);
  get account() { return this.accountState(); }
  set account(value: { email: string; role: AccountRole } | null) { this.accountState.set(value); }
  private profileSaveController?: AbortController;
  // Inspect in a debugger: no UUIDs, personal values, tokens or session objects.
  readonly profileSaveDiagnostics = signal<{
    stage: string; identityMatches?: boolean; active?: boolean;
    fields?: string[]; status?: number; code?: string;
    returnedIdentityMatches?: boolean; persistedValuesMatch?: boolean;
  }>({ stage: 'idle' });
  private identityVersion = 0;

  private recoveryUserId: string | null = null;

  // The profile picture chosen at signup. It waits here until the user has a
  // session (after the email code is verified), then it is uploaded.
  private pendingAvatar: { email: string; file: File } | null = null;

  // The terms version the user agreed to at signup. It waits here until the user
  // has a session (after the email code is verified), then it is recorded.
  private pendingTerms: { email: string; version: string } | null = null;

  constructor() {
    this.client.auth.onAuthStateChange((event, session) => {
      if (
        event === 'SIGNED_OUT' ||
        (this.profile.profile.id && session?.user.id !== this.profile.profile.id) ||
        (
          this.recoveryUserId &&
          session?.user.id !== this.recoveryUserId
        )
      ) {
        this.identityVersion++;
        this.recoveryUserId = null;
        this.account = null;
        this.profileSaveController?.abort();
        this.profile.clear();
      }
    });
  }

  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    contactNo: string;
    address: string;
    birthday: string;
    gender: string;
    }, avatar: File | null = null, termsVersion = ''): Promise<boolean> {
    this.recoveryUserId = null;
    this.account = null;
    this.profile.clear();
    this.pendingAvatar = null; // forget any picture from an earlier attempt
    this.pendingTerms = null;

    const { data, error } = await this.client.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          first_name: input.firstName.trim(),
          last_name: input.lastName.trim(),
          full_name: input.firstName.trim() + ' ' + input.lastName.trim(),
          contact_no: input.contactNo.trim(),
          address: input.address.trim(),
          birthday: input.birthday,
          gender: input.gender,
        },
      },
    });

    if (error) throw error;
    if (!data.user) {
      throw new Error('Registration could not be completed. Please try again.');
    }
    if (data.user.identities && data.user.identities.length === 0) {
      throw Object.assign(
        new Error('This email is already registered. Log in or use a different email.'),
        { code: 'email_exists' },
      );
    }
    if (avatar) this.pendingAvatar = { email: input.email.trim().toLowerCase(), file: avatar };
    if (termsVersion) this.pendingTerms = { email: input.email.trim().toLowerCase(), version: termsVersion };
    if (data.session) {
      await this.savePendingTerms(input.email);
      await this.savePendingAvatar(input.email);
    }

    return !!data.session;
  }

  async verifySignupCode(email: string, code: string): Promise<void> {
    this.recoveryUserId = null;
    const { data, error } = await this.client.auth.verifyOtp({ 
      email: email.trim(), 
      token: code, 
      type: 'signup' 
    });
    if (error) throw error;
    if (!data.user || !data.session) throw new Error('Confirmation failed. Request another code.');

    await this.savePendingTerms(email); // record the terms agreed at signup
    await this.savePendingAvatar(email); // save the picture chosen at signup
    await this.savePendingAvatar(email); // save the picture chosen at signup
  }

  async resendSignupCode(email: string): Promise<void> {
    const { error } = await this.client.auth.resend({ 
      type: 'signup', 
      email: email.trim() 
    });
    if (error) throw error;
  }

  // Records that the user agreed to the terms. It never fails the signup:
  // the account already exists, so a failed save is only reported through the return value.
  async savePendingTerms(email: string): Promise<boolean> {
    const pending = this.pendingTerms;
    if (!pending) return true;
    this.pendingTerms = null;

    // Only save it for the same email that signed up
    if (pending.email !== email.trim().toLowerCase()) return false;

    try {
      const { error } = await this.client.rpc('record_terms_acceptance', {
        accepted_version: pending.version,
      });
      return !error;
    } catch {
      return false;
    }
  }

  // Saves the picture chosen at signup. It never fails the signup:
  // if the upload doesn't work, the user can add the picture later in Edit profile.
  async savePendingAvatar(email: string): Promise<boolean> {
    const pending = this.pendingAvatar;
    if (!pending) return true;
    this.pendingAvatar = null;

    // Only save it for the same email that signed up
    if (pending.email !== email.trim().toLowerCase()) return false;

    try {
      await this.uploadProfilePicture(pending.file);
      return true;
    } catch {
      return false;
    }
  }

  // Uploads a profile picture to Storage and saves its link in the user's profile.
  // Returns the link of the picture.
  async uploadProfilePicture(file: File): Promise<string> {
    const { data, error: userError } = await this.client.auth.getUser();
    const user = data.user;

    if (userError || !user) {
      throw new Error('Please log in to upload a profile picture.');
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Choose a JPG, PNG or WebP picture.');
    }

    // Maximum original image size: 12 MB
    if (file.size > 12 * 1024 * 1024) {
      throw new Error('The image must not exceed 12 MB.');
    }

    // Compress before uploading.
    const compressedFile = await this.compressProfilePicture(file);

    const path = `${user.id}/avatar`;

    const { error: uploadError } = await this.client.storage
      .from('avatars')
      .upload(path, compressedFile, {
        upsert: true,
        contentType: compressedFile.type,
        cacheControl: '3600'
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = this.client.storage
      .from('avatars')
      .getPublicUrl(path);

    const url = `${urlData.publicUrl}?v=${Date.now()}`;

    const { error: saveError } = await this.client
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', user.id);

    if (saveError) throw saveError;

    if (this.profile.profile.id === user.id) {
      this.profile.profile = {
        ...this.profile.profile,
        profilePictureUrl: url
      };
    }

    return url;
  }

    // Deletes the profile picture from Storage and clears its link in the profile.
  async removeProfilePicture(): Promise<void> {
    const { data, error: userError } = await this.client.auth.getUser();
    const user = data.user;

    if (userError || !user) {
      throw new Error('Please log in to remove your profile picture.');
    }

    const { data: removed, error: removeError } = await this.client.storage
      .from('avatars')
      .remove([`${user.id}/avatar`]);

    if (removeError) throw removeError;

    // Supabase gives an empty list (and no error) when the storage rules block the delete
    if (!removed || removed.length === 0) {
      throw new Error('The picture could not be removed. Ask the administrator to check the storage delete permission.');
    }

    const { error: saveError } = await this.client
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id);

    if (saveError) throw saveError;

    if (this.profile.profile.id === user.id) {
      this.profile.profile = { ...this.profile.profile, profilePictureUrl: '' };
    }
  }

  async login(email: string, password: string): Promise<AccountRole> {
    this.recoveryUserId = null;
    this.pendingAvatar = null;
    this.account = null;
    this.profile.clear();

    const { data, error } =
      await timeLoginStage('signInWithPassword', () => this.client.auth.signInWithPassword({
        email: email.trim(),
        password,
      }));

    if (error) throw error;

    if (!data.user) {
      throw new Error('No user was returned. Please sign in again.');
    }

    try {
      const role = await this.readAccountRole(data.user.id);
      this.account = { email: data.user.email || '', role };
      this.profile.profile = { ...this.profile.profile, email: this.account.email };
      return role;
    } catch (error) {
      await this.client.auth.signOut({ scope: 'local' });
      throw error;
    }
  }

  // Revalidate against Auth and the backend on every guarded navigation.
  async getAccountRole(): Promise<AccountRole> {
    const version = this.identityVersion;

    // No internet: the check can't reach Supabase, so keep using the login and role
    // the app already loaded instead of logging the user out
    if (!navigator.onLine && this.account && this.profile.profile.id) {
      return this.account.role;
    }

    try {
      const { data, error } = await this.client.auth.getUser();
      if (version !== this.identityVersion) throw new Error('Your sign-in session changed. Please try again.');

      // Connected to a network but the request still failed: same idea
      if (error && error.name === 'AuthRetryableFetchError' && this.account && this.profile.profile.id) {
        return this.account.role;
      }

      if (error || !data.user) throw new Error('Please sign in to continue.');
      if (this.profile.profile.id && this.profile.profile.id !== data.user.id) {
        this.account = null;
        this.profile.clear();
      }
      const role = await this.readAccountRole(data.user.id, version);
      if (version !== this.identityVersion) throw new Error('Your sign-in session changed. Please try again.');
      this.account = { email: data.user.email || '', role };
      this.profile.profile = { ...this.profile.profile, email: this.account.email };
      return role;
    } catch (error) {
      // The connection dropped in the middle of the check: keep the saved login
      if (!navigator.onLine && this.account && this.profile.profile.id) {
        return this.account.role;
      }
      if (version === this.identityVersion) {
        this.account = null;
        this.profile.clear();
      }
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      const { error } = await this.client.auth.signOut({ scope: 'local' });
      // No internet: Supabase couldn't be reached, so remove the saved login ourselves
      if (error) this.clearStoredSession();
    } catch {
      this.clearStoredSession();
    }

    // Always clear what the app remembers, even if the server could not be reached
    this.account = null;
    this.recoveryUserId = null;
    this.pendingAvatar = null;
    this.profile.clear();
  }

  // Removes this device's saved Supabase login (used when logging out offline)
  private clearStoredSession() {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // storage is not available, nothing to remove
    }
  }

    // The logged-in user deactivates their own account, then is logged out.
  async deactivateOwnAccount(): Promise<void> {
    const { data, error } = await this.client.rpc('deactivate_own_account');

    if (error) {
      if (error.message?.includes('last_admin')) {
        throw new Error('You are the only active admin. Make another admin first.');
      }
      if (error.code === 'PGRST202') {
        throw new Error('Account deactivation is not available yet. Contact the administrator.');
      }
      throw new Error('Your account could not be deactivated. Please try again.');
    }

    if (data !== true) {
      throw new Error('The deactivation could not be confirmed. Please try again.');
    }

    // Log out of every device. If that fails, at least log out here.
    const { error: signOutError } = await this.client.auth.signOut({ scope: 'global' });
    if (signOutError) await this.client.auth.signOut({ scope: 'local' });

    this.account = null;
    this.recoveryUserId = null;
    this.pendingAvatar = null;
    this.profile.clear();
  }

  private async readAccountRole(userId: string, version = this.identityVersion): Promise<AccountRole> {
    const { data: profile, error } = await timeLoginStage('profile active/role check', () =>
      this.client.from('profiles').select('*').eq('id', userId).single());
    if (version !== this.identityVersion) throw new Error('Your sign-in session changed. Please try again.');
    if (error || !profile) {
      throw new Error('Your account profile or role could not be loaded. Contact the administrator.');
    }
    if (profile.active !== true) {
      throw new Error('Your account is inactive. Contact the administrator.');
    }
    if (profile.role !== 'customer' && profile.role !== 'technician' && profile.role !== 'admin') {
      throw new Error('Your account role is missing or invalid. Contact the administrator.');
    }
    return this.hydrateProfile(userId, profile);
  }

  private hydrateProfile(userId: string, profile: Record<string, unknown>): AccountRole {
    if (profile['active'] !== true || !['admin', 'customer', 'technician'].includes(String(profile['role']))) {
      throw new Error('Your profile access could not be validated. Please sign in again.');
    }
    const text = (value: unknown): string => typeof value === 'string' ? value : '';
    const firstName = text(profile['first_name']).trim();
    const lastName = text(profile['last_name']).trim();
    this.profile.profile = {
      id: userId, firstName: firstName || (!lastName ? text(profile['full_name']).trim() : ''),
      accountNo: text(profile['account_no']),
      lastName, email: this.account?.email || '',
      contactNo: text(profile['contact_no']) || text(profile['phone']),
      address: text(profile['address']), birthday: text(profile['birthday']),
      gender: text(profile['gender']), profilePictureUrl: text(profile['avatar_url']),
      role: profile['role'] as AccountRole, isActive: true, joinedDate: text(profile['created_at']),
    };
    return profile['role'] as AccountRole;
  }

  async saveOwnProfile(expectedUserId: string, changes: ProfileChanges): Promise<boolean> {
    if (this.profileSaveController) throw new Error('A profile save is already in progress.');
    const controller = new AbortController();
    const identityVersion = this.identityVersion;
    this.profileSaveController = controller;
    this.profileSaveDiagnostics.set({ stage: 'auth/profile validation' });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let profileConfirmed = false;
    let metadataSynced = false;
    try {
      await Promise.race([
        (async () => {
          await this.getAccountRole();
          if (controller.signal.aborted || identityVersion !== this.identityVersion) throw new Error('Your sign-in session changed. Reopen your profile.');
          this.profileSaveDiagnostics.set({ stage: 'identity validation',
            identityMatches: !!expectedUserId && this.profile.profile.id === expectedUserId,
            active: this.profile.profile.isActive === true });
          if (!expectedUserId || this.profile.profile.id !== expectedUserId) {
            throw new Error('The signed-in account changed. Reopen Edit profile before saving.');
          }
          const userId = this.profile.profile.id;
          const payload = {
            first_name: changes.firstName.trim(),
            last_name: changes.lastName.trim(),
            full_name: `${changes.firstName.trim()} ${changes.lastName.trim()}`.trim(),
            contact_no: changes.contactNo.trim(),
            phone: changes.contactNo.trim(),
            address: (changes.address || '').trim(),
            birthday: changes.birthday || null,
            gender: changes.gender || null,
          };
          this.profileSaveDiagnostics.update(state => ({ ...state, stage: 'update', fields: Object.keys(payload) }));
          // Explicit personal-field allowlist. UUID ownership is enforced by RLS;
          // the existing trigger still protects role, active and profile id.
          const { data, error, status } = await this.client.from('profiles').update(payload)
            .eq('id', userId).select('*').abortSignal(controller.signal).single();
          this.profileSaveDiagnostics.update(state => ({ ...state, status, code: error?.code,
            returnedIdentityMatches: data?.id === userId }));
          if (controller.signal.aborted || identityVersion !== this.identityVersion || this.profile.profile.id !== userId) {
            throw new Error('The save result could not be confirmed. Reopen your profile.');
          }
          if (error) {
            // Retain the original response for debugger inspection without
            // printing raw messages/details that may contain personal values.
            const failure = (message: string) => Object.assign(new Error(message), { cause: error });
            // Show safe, actionable categories rather than raw backend messages,
            // which can contain personal field values or database details.
            if (error.code === 'PGRST204' || error.code === '42703') {
              throw failure('Your profile could not be saved because the profile database needs an update. Ask the administrator to check the profile fields, including the address migration (0095). Your edits are still here.');
            }
            if (error.code === '42501' || error.code === 'PGRST116') {
              throw failure('Your profile could not be saved because profile update access could not be confirmed. Sign in again and retry. If it continues, ask the administrator to check own-profile update permissions. Your edits are still here.');
            }
            if (['23514', '23502', '22007', '22008', '22P02', '22001'].includes(error.code)) {
              throw failure('Your profile could not be saved because a field does not match the database requirements. Check your name, phone, address, birthday and gender. Your edits are still here.');
            }
            if (!error.code || error.code.startsWith('08') || error.code.startsWith('PGRST00')) {
              throw failure('The profile save result could not be confirmed because of a connection problem. Reopen your profile to check the saved values before retrying.');
            }
            throw failure('Your profile could not be saved. Please retry or contact the administrator.');
          }
          if (!data) throw new Error('Your profile could not be saved because no updated profile was returned. Ask the administrator to check own-profile update permissions.');
          // single() rejects zero/multiple rows; also require the expected UUID.
          if (data.id !== userId) throw new Error('The updated profile identity could not be confirmed. Reopen your profile before retrying.');
          this.profileSaveDiagnostics.update(state => ({ ...state, stage: 'persistence reload' }));
          // A separate server read verifies persistence before publishing any
          // edited values or letting the editor navigate away.
          const { data: saved, error: reloadError } = await this.client.from('profiles')
            .select('*').eq('id', userId).abortSignal(controller.signal).single();
          if (controller.signal.aborted || identityVersion !== this.identityVersion || this.profile.profile.id !== userId) {
            throw new Error('The save result could not be confirmed. Reopen your profile.');
          }
          if (reloadError || !saved || saved.id !== userId) {
            this.profileSaveDiagnostics.update(state => ({ ...state, code: reloadError?.code }));
            throw Object.assign(new Error('The update was accepted, but the saved profile could not be reloaded. Reopen your profile to check the saved values before retrying.'), { cause: reloadError });
          }
          const persistedValuesMatch = Object.entries(payload).every(([field, value]) => saved[field] === value);
          this.profileSaveDiagnostics.update(state => ({ ...state, persistedValuesMatch }));
          if (!persistedValuesMatch) {
            throw new Error('The saved profile does not match your edits. Another update or a database rule may have changed it. Reopen your profile before retrying.');
          }
          const role = this.hydrateProfile(userId, saved);
          if (this.account) this.account = { ...this.account, role };
          this.profileSaveDiagnostics.update(state => ({ ...state, stage: 'confirmed' }));
          profileConfirmed = true;
          metadataSynced = await this.syncProfileName(userId, saved, identityVersion);
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            this.profileSaveDiagnostics.update(state => ({ ...state, stage: 'timed out' }));
            reject(new Error('The save result is unknown. Reopen your profile before trying again.'));
          }, 20000);
        }),
      ]);
      return metadataSynced;
    } catch (error) {
      if (profileConfirmed) return false;
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (this.profileSaveController === controller) this.profileSaveController = undefined;
    }
  }

  private nameSyncPending = false;

  // Retry reads the source of truth again; it never resubmits profile edits.
  async retryProfileNameSync(expectedUserId: string): Promise<boolean> {
    if (this.profileSaveController || this.nameSyncPending) return false;
    const version = this.identityVersion;
    await this.getAccountRole();
    if (version !== this.identityVersion || this.profile.profile.id !== expectedUserId) return false;
    const { data, error } = await this.client.from('profiles').select('*').eq('id', expectedUserId).single();
    if (error || !data || data.id !== expectedUserId || data.active !== true) return false;
    return this.syncProfileName(expectedUserId, data, version);
  }

  private async syncProfileName(userId: string, saved: Record<string, unknown>, version: number): Promise<boolean> {
    if (this.nameSyncPending) return false;
    this.nameSyncPending = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    const current = () => !expired && version === this.identityVersion && this.profile.profile.id === userId;
    const request = (async () => {
      const { data, error } = await this.client.auth.getUser();
      if (error || data.user?.id !== userId || !current() || saved['active'] !== true) return false;
      const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
      const first = text(saved['first_name']), last = text(saved['last_name']);
      const full = text(saved['full_name']) || `${first} ${last}`.trim();
      // Signup uses full_name/first_name/last_name. Also replace the legacy
      // name alias so dashboard/provider metadata cannot retain an old name.
      const names: Record<string, string> = { first_name: first, last_name: last, full_name: full, name: full };
      if (Object.prototype.hasOwnProperty.call(data.user.user_metadata || {}, 'display_name')) names['display_name'] = full;
      const result = await this.client.auth.updateUser({ data: names });
      return !result.error && current() && result.data.user?.id === userId
        && Object.entries(names).every(([key, value]) => result.data.user?.user_metadata?.[key] === value);
    })().catch(() => false).finally(() => { this.nameSyncPending = false; });
    try {
      return await Promise.race([request, new Promise<boolean>(resolve => {
        timer = setTimeout(() => { expired = true; resolve(false); }, 10000);
      })]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }

  private async compressProfilePicture(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file);

    try {
      const maxDimension = 800;
      const maxSize = 500 * 1024;

      let width = bitmap.width;
      let height = bitmap.height;

      const scale = Math.min(
        1,
        maxDimension / Math.max(width, height)
      );

      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Image compression is not supported.');
      }

      let compressedBlob: Blob | null = null;

      for (let attempt = 0; attempt < 12; attempt++) {
        canvas.width = width;
        canvas.height = height;

        context.clearRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);

        const quality = Math.max(0.35, 0.80 - attempt * 0.05);

        compressedBlob = await new Promise<Blob | null>(resolve => {
          canvas.toBlob(resolve, 'image/webp', quality);
        });

        if (!compressedBlob) {
          throw new Error('Image compression failed.');
        }

        if (compressedBlob.size <= maxSize) {
          break;
        }

        width = Math.round(width * 0.85);
        height = Math.round(height * 0.85);
      }

      if (!compressedBlob || compressedBlob.size > maxSize) {
        throw new Error('Unable to compress image below 500 KB.');
      }

      return new File(
        [compressedBlob],
        `avatar-${Date.now()}.webp`,
        {
          type: 'image/webp',
          lastModified: Date.now()
        }
      );
    } finally {
      bitmap.close();
    }
  }

  async sendResetCode(email: string): Promise<void> {
    this.recoveryUserId = null;

    const { error } =
      await this.client.auth.resetPasswordForEmail(email.trim());

    if (error) throw error;
  }

  async verifyResetCode(
    email: string,
    code: string
  ): Promise<void> {
    this.recoveryUserId = null;

    const { data, error } =
      await this.client.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'recovery',
      });

    if (error) throw error;

    if (!data.user || !data.session) {
      throw new Error(
        'Verification failed. Request another code.'
      );
    }

    this.recoveryUserId = data.user.id;
  }

  async canResetPassword(): Promise<boolean> {
    if (!this.recoveryUserId) return false;

    const {
      data: { user },
      error,
    } = await this.client.auth.getUser();

    return !error &&
      !!user &&
      user.id === this.recoveryUserId;
  }

  async resetPassword(password: string): Promise<void> {
    if (!(await this.canResetPassword())) {
      throw new Error('Verify a recovery code first.');
    }

    const { error } =
      await this.client.auth.updateUser({ password });

    if (error) throw error;

    this.recoveryUserId = null;

    const { error: logoutError } =
      await this.client.auth.signOut({ scope: 'global' });

    if (logoutError) {
      await this.client.auth.signOut({ scope: 'local' });

      throw new Error(
        'Password changed, but other sessions could not be signed out. Return to login and use your new password.'
      );
    }
  }

  // Changes the password of the logged-in user.
  // Returns true if the other devices were logged out too.
  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    const { data: userData, error: userError } = await this.client.auth.getUser();
    const user = userData.user;

    if (userError || !user || !user.email) {
      throw new Error('Please log in again to change your password.');
    }

    // Verify the current password by re-authenticating.
    const { error: verifyError } = await this.client.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      if (verifyError.code === 'invalid_credentials') {
        throw new Error('Your current password is incorrect.');
      }
      throw verifyError;
    }

    const { error } = await this.client.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });

    if (error) {
      if (error.code === 'same_password') {
        throw new Error('New password must be different from your current password.');
      }
      throw error;
    }

    const { error: signOutError } = await this.client.auth.signOut({ scope: 'others' });
    return !signOutError;
  }
}

export const accountsRecoveryGuard: CanActivateFn = async () => {
  const auth = inject(AccountsAuthService);
  const router = inject(Router);

  return await auth.canResetPassword() ||
    router.createUrlTree(['/accounts-forgot-password']);
};
export function accountsRoleGuard(allowed: readonly AccountRole[]): CanActivateFn {
  return async () => {
    const auth = inject(AccountsAuthService);
    const router = inject(Router);
    try {
      const role = await auth.getAccountRole();
      if (allowed.includes(role)) return true;
      return router.createUrlTree(['/accounts-login'], {
        queryParams: { accessError: 'forbidden' },
      });
    } catch {
      return router.createUrlTree(['/accounts-login'], {
        queryParams: { accessError: 'unavailable' },
      });
    }
  };
}

// On the login page: if the user already has a valid session, skip the login screen
export const accountsLoggedInRedirect: CanActivateFn = async () => {
  const auth = inject(AccountsAuthService);
  const router = inject(Router);

  try {
    const role = await auth.getAccountRole();
    return router.createUrlTree([accountLoginDestination(role)]);
  } catch {
    return true; // not signed in (or no connection): show the login page
  }
};