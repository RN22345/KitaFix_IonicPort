import { Injectable, signal } from '@angular/core';
import { Account } from '../models/account.model';

export type ProfileChanges = Pick<Account, 'firstName' | 'lastName' | 'contactNo' | 'address' | 'birthday' | 'gender'>;

// The profile of the user who is logged in.
// The My account, Edit profile and Change password pages share it.
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly state = signal<Account>({
    id: '', firstName: '', lastName: '', email: '', contactNo: '',
    address: '', birthday: '', gender: '', profilePictureUrl: '',
    role: 'customer', isActive: false, joinedDate: '',
  });

  get profile(): Account { return this.state(); }
  set profile(value: Account) { this.state.set(value); }

  clear() {
    this.profile = {
      id: '', firstName: '', lastName: '', email: '', contactNo: '',
      address: '', birthday: '', gender: '', profilePictureUrl: '',
      role: 'customer', isActive: false, joinedDate: '',
    };
  }

}
