import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'kf-repair-extras';

interface Stored {
  favorites: string[];
  ratings: Record<string, number>;
}

function read(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { favorites: [], ratings: {} };
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      ratings: parsed.ratings && typeof parsed.ratings === 'object' ? parsed.ratings : {},
    };
  } catch {
    return { favorites: [], ratings: {} };
  }
}

/** Customer-only extras for a repair: favourite heart and submitted 1-5 star rating. */
@Injectable({ providedIn: 'root' })
export class RepairExtrasService {
  private readonly initial = read();
  readonly favorites = signal<string[]>(this.initial.favorites);
  readonly ratings = signal<Record<string, number>>(this.initial.ratings);
  readonly favoriteCount = computed(() => this.favorites().length);

  isFavorite(id: string): boolean {
    return this.favorites().includes(id);
  }

  toggleFavorite(id: string): void {
    this.favorites.update((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
    this.save();
  }

  ratingOf(id: string): number {
    return this.ratings()[id] ?? 0;
  }

  /** Saves a submitted rating (1-5). Unlike before, it never toggles off. */
  submitRating(id: string, stars: number): void {
    const value = Math.min(5, Math.max(1, Math.round(stars)));
    this.ratings.update((map) => ({ ...map, [id]: value }));
    this.save();
  }

  clearRating(id: string): void {
    this.ratings.update((map) => {
      const copy = { ...map };
      delete copy[id];
      return copy;
    });
    this.save();
  }

  /** Kept for old callers: same as submitRating. */
  setRating(id: string, stars: number): void {
    this.submitRating(id, stars);
  }

  private save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ favorites: this.favorites(), ratings: this.ratings() }),
      );
    } catch {
      // Storage blocked: the choice just is not remembered.
    }
  }
}