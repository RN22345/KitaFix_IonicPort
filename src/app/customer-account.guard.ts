import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountsAuthService } from '@kitafix/accounts';

/**
 * Customers see Team 1's account pages inside the customer tabs (/tabs/account...),
 * with the app's top bar, bottom bar and theme. Team 1's pages still link to and
 * navigate to their own top-level paths (/accounts-my-account etc.), so those
 * paths send a customer to the tab version. Admins and technicians stay put.
 */
export function customerGoesToTab(tabPath: string): CanActivateFn {
  return async () => {
    const auth = inject(AccountsAuthService); // inject() only works before the first await
    const router = inject(Router);
    try {
      const role = await auth.getAccountRole();
      return role === 'customer' ? router.parseUrl(tabPath) : true;
    } catch {
      return true; // not signed in: the role guard on the same route handles it
    }
  };
}
