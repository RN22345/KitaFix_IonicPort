import { Tone } from './repair.model';

export type RankKey = 'member' | 'established' | 'elite';

export interface RankTier {
  key: RankKey;
  label: string;
  /** Completed repairs needed to reach this tier. */
  minRepairs: number;
  icon: string;
  tone: Tone;
  blurb: string;
}

export const RANK_TIERS: readonly RankTier[] = [
  { key: 'member', label: 'New Customer', minRepairs: 0, icon: 'sparkles-outline', tone: 'accent', blurb: 'Just getting started' },
  { key: 'established', label: 'Established Customer', minRepairs: 5, icon: 'ribbon-outline', tone: 'violet', blurb: 'A trusted regular' },
  { key: 'elite', label: 'Elite Customer', minRepairs: 10, icon: 'trophy-outline', tone: 'orange', blurb: 'Our most valued customer' },
];

export interface CustomerRank {
  tier: RankTier;
  next: RankTier | null;
  completed: number;
  remaining: number;
  /** 0-100 progress towards the next tier (100 at the top tier). */
  progress: number;
}

/** 5 completed repairs = Established Customer, 10 = Elite Customer. */
export function customerRank(completed: number): CustomerRank {
  const count = Math.max(0, completed);
  const tier = [...RANK_TIERS].reverse().find((item) => count >= item.minRepairs) ?? RANK_TIERS[0];
  const next = RANK_TIERS.find((item) => item.minRepairs > tier.minRepairs) ?? null;
  if (!next) {
    return { tier, next: null, completed: count, remaining: 0, progress: 100 };
  }
  const span = next.minRepairs - tier.minRepairs;
  const progress = Math.min(100, Math.round(((count - tier.minRepairs) / span) * 100));
  return { tier, next, completed: count, remaining: next.minRepairs - count, progress };
}