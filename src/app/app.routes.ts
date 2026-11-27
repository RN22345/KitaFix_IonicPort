import { Routes } from '@angular/router';
import { accountsRecoveryGuard, accountsRoleGuard, accountsLoggedInRedirect } from '@kitafix/accounts';

/**
 * The app shell only declares lazy routes that point into each team's library
 * (rule R7). Team 2's screens live behind '@kitafix/booking' -> BOOKING_ROUTES.
 *
 * In the merged group app the tabs list grows with the other teams' routes
 * (identity, repair-ops, insights); Team 2 only owns the booking entries.
 */
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
    ],
  },
  {
  path: 'accounts-login',
  canActivate: [accountsLoggedInRedirect],
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/login/login')
        .then((m) => m.LoginPage),
  },
  {
    path: 'accounts-signup',
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/signup/signup')
        .then((m) => m.SignupPage),
  },
  {
    path: 'accounts-forgot-password',
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/forgot-password/forgot-password')
        .then((m) => m.ForgotPasswordPage),
  },
  {
  path: 'accounts-reset-password',
  canActivate: [accountsRecoveryGuard],
  loadComponent: () =>
    import(
      '../../libs/accounts/src/lib/pages/reset-password/reset-password'
    ).then((m) => m.ResetPasswordPage),
},
  {
    path: 'accounts-verify-email',
    loadComponent: () =>
      import('../../libs/accounts/src/lib/pages/verify-email/verify-email')
        .then((m) => m.VerifyEmailPage),
  },
  { path: 'accounts-my-account',
    canActivate: [accountsRoleGuard(['customer', 'technician', 'admin'])], 
    loadComponent: () => 
      import('../../libs/accounts/src/lib/pages/my-account/my-account')
        .then((m) => m.MyAccountPage) },
  {
    path: 'accounts-edit-profile',
    canActivate: [accountsRoleGuard(['customer', 'technician', 'admin'])], 
    loadComponent: () => 
      import('../../libs/accounts/src/lib/pages/edit-profile/edit-profile')
        .then((m) => m.EditProfilePage) 
  },
  { 
    path: 'accounts-change-password',
    canActivate: [accountsRoleGuard(['customer', 'technician', 'admin'])], 
    loadComponent: () => 
      import('../../libs/accounts/src/lib/pages/change-password/change-password')
        .then((m) => m.ChangePasswordPage) 
  },
  { 
    path: 'accounts-list',
    canActivate: [accountsRoleGuard(['admin'])], 
    loadComponent: () => 
      import('../../libs/accounts/src/lib/pages/accounts-list/accounts-list')
        .then((m) => m.AccountsListPage) 
  },
  { 
    path: 'accounts-profile/:id',
    canActivate: [accountsRoleGuard(['admin'])], 
    loadComponent: () => 
      import('../../libs/accounts/src/lib/pages/account-profile/account-profile')
        .then((m) => m.AccountProfilePage) 
  },
  { 
    path: 'accounts-roles',
    canActivate: [accountsRoleGuard(['admin'])], 
    loadComponent: () => 
      import('../../libs/accounts/src/lib/pages/roles-management/roles-management')
        .then((m) => m.RolesManagementPage) 
  },
  { path: '', redirectTo: 'accounts-login', pathMatch: 'full' },
  { path: '**', redirectTo: 'accounts-login' },
];
