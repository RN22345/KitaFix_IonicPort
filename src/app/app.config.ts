import {
  ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';

import {
  RouteReuseStrategy,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';

import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular';

import {
  getSupabaseClient,
  provideBooking,
} from '@kitafix/booking';

import { ACCOUNTS_AUTH_CLIENT } from '@kitafix/accounts';
import { provideRepairOps } from '@kitafix/repair-ops';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({
      eventCoalescing: true,
    }),

    {
      provide: RouteReuseStrategy,
      useClass: IonicRouteStrategy,
    },

    provideIonicAngular(),

    provideRouter(
      routes,
      withComponentInputBinding()
    ),

    {
      provide: ACCOUNTS_AUTH_CLIENT,
      useFactory: () =>
        getSupabaseClient(
          environment.supabaseUrl,
          environment.supabaseAnonKey
        ),
    },

    provideBooking({
      useMockData: environment.useMockData,
      supabaseUrl: environment.supabaseUrl,
      supabaseAnonKey: environment.supabaseAnonKey,
      locations: environment.locations,
      slotTimes: environment.slotTimes,
      currency: environment.currency,
    }),

    // Team 3. Its technician picker reuses provideBooking's TechniciansGateway.
    provideRepairOps({
      useMockData: environment.useMockData,
      supabaseUrl: environment.supabaseUrl,
      supabaseAnonKey: environment.supabaseAnonKey,
      currency: environment.currency,
    }),
  ],
};