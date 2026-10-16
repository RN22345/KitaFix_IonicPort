import { Injectable, signal } from '@angular/core';
import { DeviceCatalog } from './device-search';

/** Built by tools/device-catalog and refreshed weekly by .github/workflows/device-catalog.yml. */
const CATALOG_URL = 'assets/data/device-catalog.json';

/**
 * Loads the brand/model list once, on first use (New Booking only), from the
 * app's own assets - so it works offline too. If it cannot load, the fields
 * still accept typed text; they just show no suggestions.
 */
@Injectable({ providedIn: 'root' })
export class DeviceCatalogService {
  readonly catalog = signal<DeviceCatalog>({ brands: [] });
  readonly ready = signal(false);
  private loading: Promise<void> | null = null;

  load(): Promise<void> {
    this.loading ??= this.fetchCatalog();
    return this.loading;
  }

  private async fetchCatalog(): Promise<void> {
    try {
      const response = await fetch(CATALOG_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as DeviceCatalog;
      this.catalog.set({ brands: Array.isArray(data.brands) ? data.brands : [] });
      this.ready.set(true);
    } catch (error) {
      // Suggestions are a convenience: typing still works without them.
      console.warn('Device suggestions unavailable:', error);
      this.loading = null;
    }
  }
}
