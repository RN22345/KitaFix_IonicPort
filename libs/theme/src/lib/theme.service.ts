import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

/** localStorage key; src/index.html reads the same key before the app boots. */
export const THEME_STORAGE_KEY = 'kf-theme';

/** Dark unless the viewer explicitly picked light on this device. */
export function parseThemeMode(value: string | null | undefined): ThemeMode {
  return value === 'light' ? 'light' : 'dark';
}

/**
 * App-wide light/dark switch (shared, not owned by one team).
 * Dark is the default. The choice is remembered per device.
 * Colours live in src/global.scss as --kf-* tokens; this service only toggles
 * Ionic's `ion-palette-dark` class on <html>.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly mode = signal<ThemeMode>(this.readStored());

  constructor() {
    this.apply(this.mode());
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    this.apply(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Private mode or blocked storage: the choice just is not remembered.
    }
  }

  toggle(): void {
    this.set(this.mode() === 'dark' ? 'light' : 'dark');
  }

  private readStored(): ThemeMode {
    try {
      return parseThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      return 'dark';
    }
  }

  private apply(mode: ThemeMode): void {
    const root = this.document.documentElement;
    root.classList.toggle('ion-palette-dark', mode === 'dark');
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'dark' ? '#0b1220' : '#e8edf5');
  }
}
