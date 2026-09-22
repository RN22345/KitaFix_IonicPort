import { UserRole } from '@kitafix/shared-types';

/** The signed-in person, as far as the booking module needs to know. */
export interface CurrentUser {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
}
