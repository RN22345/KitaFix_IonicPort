import { Routes } from '@angular/router';
import { accountsLoggedInRedirect, accountsRecoveryGuard, accountsRoleGuard } from '@kitafix/accounts';

/**
 * The app shell only declares lazy routes that point into each team's library
 * (rule R7).
 *   Team 1 (accounts)  - login, signup, profile, admin account screens
 *   Team 2 (booking)   - customer tabs: /tabs/...
 *   Team 3 (repair ops) - pending (technician screens)
 *   Team 4 (insights)  - /tabs/leave-review/:repairId and the /admin shell
 * Who may open what is Team 1's accountsRoleGuard.
 */
const anyRole = accountsRoleGuard(['customer', 'technician', 'admin']);
const adminOnly = accountsRoleGuard(['admin']);

// shortcut: Team 1 pages are imported by deep path because libs/accounts does
// not export routes yet. Move these into an ACCOUNTS_ROUTES export (rule R6).

export const routes: Routes = [
  {
    path: 'tabs',
    canActivate: [accountsRoleGuard(['customer'])],
    canActivateChild: [accountsRoleGuard(['customer'])],
    loadComponent: () => import('./tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: '',
        loadChildren: () => import('@kitafix/booking').then((m) => m.BOOKING_ROUTES),
      },
      {
        path: '',
        loadChildren: () => import('@kitafix/insights').then((m) => m.INSIGHTS_ROUTES),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [adminOnly],
    loadChildren: () => import('@kitafix/insights').then((m) => m.INSIGHTS_STAFF_ROUTES),
  },

  // Team 1 - accounts
  {
    path: 'accounts-login',
    canActivate: [accountsLoggedInRedirect],
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'accounts-signup',
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/signup/signup').then((m) => m.SignupPage),
  },
  {
    path: 'accounts-forgot-password',
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/forgot-password/forgot-password').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'accounts-reset-password',
    canActivate: [accountsRecoveryGuard],
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/reset-password/reset-password').then((m) => m.ResetPasswordPage),
  },
  {
    path: 'accounts-verify-email',
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/verify-email/verify-email').then((m) => m.VerifyEmailPage),
  },
  {
    path: 'accounts-my-account',
    canActivate: [anyRole],
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/my-account/my-account').then((m) => m.MyAccountPage),
  },
  {
    path: 'accounts-edit-profile',
    canActivate: [anyRole],
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/edit-profile/edit-profile').then((m) => m.EditProfilePage),
  },
  {
    path: 'accounts-change-password',
    canActivate: [anyRole],
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/change-password/change-password').then((m) => m.ChangePasswordPage),
  },
  {
    path: 'accounts-list',
    canActivate: [adminOnly],
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/accounts-list/accounts-list').then((m) => m.AccountsListPage),
  },
  {
    path: 'accounts-profile/:id',
    canActivate: [adminOnly],
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/account-profile/account-profile').then((m) => m.AccountProfilePage),
  },
  {
    path: 'accounts-roles',
    canActivate: [adminOnly],
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/roles-management/roles-management').then((m) => m.RolesManagementPage),
  },

  { path: '', redirectTo: 'accounts-login', pathMatch: 'full' },
  { path: '**', redirectTo: 'accounts-login' },
];
