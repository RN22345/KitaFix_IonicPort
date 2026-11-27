import { Injectable, computed, inject, signal } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BOOKING_CONFIG, getSupabaseClient } from '@kitafix/booking';
import { AdminReview, LatestRepair, ReviewSummary, StatusCount, TechnicianRow } from '../models/admin.model';
import { ReviewRuleError } from '../models/review.model';

const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

const MOCK_REVIEWS: AdminReview[] = [
  { id: 'r1', reviewId: 'RV-00001', rating: 5, comment: 'Excellent service! Phone repaired quickly and the technician was professional.', createdAt: ago(6), customerName: 'Marites Dela Cruz', device: 'Samsung A54', location: 'Main Branch - Downtown', technicianName: 'Marco Reyes', replyText: 'Thank you Marites, see you again!', repliedAt: ago(5) },
  { id: 'r2', reviewId: 'RV-00002', rating: 4, comment: 'Good job, but I waited a bit long.', createdAt: ago(4), customerName: 'Jose Reyes', device: 'iPhone 12', location: 'North Mall Branch', technicianName: 'Dina Villanueva', replyText: null, repliedAt: null },
  { id: 'r3', reviewId: 'RV-00003', rating: 3, comment: 'Works again, price a bit high.', createdAt: ago(3), customerName: 'Ana Santos', device: 'Oppo Reno 8', location: 'Main Branch - Downtown', technicianName: 'Marco Reyes', replyText: null, repliedAt: null },
  { id: 'r4', reviewId: 'RV-00004', rating: 5, comment: null, createdAt: ago(2), customerName: 'Paolo Garcia', device: 'Realme C55', location: 'North Mall Branch', technicianName: 'Dina Villanueva', replyText: null, repliedAt: null },
];
const MOCK_STATUS: StatusCount[] = [
  { status: 'Pending', repairCount: 6 }, { status: 'In progress', repairCount: 4 }, { status: 'Testing', repairCount: 2 },
  { status: 'Completed', repairCount: 24 }, { status: 'Cancelled', repairCount: 3 },
];
const MOCK_TECHS = [
  { technicianName: 'Marco Reyes', totalRepairs: 14, completedRepairs: 12 },
  { technicianName: 'Dina Villanueva', totalRepairs: 10, completedRepairs: 9 },
  { technicianName: 'Rico Tan', totalRepairs: 3, completedRepairs: 3 },
];
const MOCK_LATEST: LatestRepair[] = [
  { id: 'a1b2c3d4', device: 'Galaxy A54', status: 'Pending', createdAt: ago(0) },
  { id: 'e5f6a7b8', device: 'iPhone 13 Pro', status: 'In progress', createdAt: ago(1) },
  { id: 'c9d0e1f2', device: 'Redmi Note 12', status: 'Completed', createdAt: ago(2) },
];

interface ReviewRow { id: string; review_id: string; repair_id: string; customer_id: string; rating: number; comment: string | null; reply_text: string | null; replied_at: string | null; created_at: string }
interface RepairRow { id: string; device_brand: string; device_model: string; location: string; technician_id: string | null; status: string; created_at: string }
interface NameRow { id: string; profile_id?: string; full_name?: string }
interface SummaryRow { total_reviews: number; average_rating: number | string | null; star_1: number; star_2: number; star_3: number; star_4: number; star_5: number }
interface StatusRow { status: string; repair_count: number }
interface TechRow { technician_name: string | null; total_repairs: number; completed_repairs: number; review_count: number; average_rating: number | string | null }

/**
 * Data for the admin pages (Overview, Reviews, Reports).
 * useMockData = true -> sample data. false -> Supabase: reviews + the 3 views.
 * Who is allowed to see these pages is Team 1's job; the database still
 * applies its own rules (RLS + triggers in migration 0040).
 */
@Injectable({ providedIn: 'root' })
export class AdminInsightsService {
  private readonly config = inject(BOOKING_CONFIG);
  private readonly live = !this.config.useMockData;

  private readonly store = signal<AdminReview[]>(this.live ? [] : MOCK_REVIEWS);
  private readonly statusRows = signal<StatusCount[]>(this.live ? [] : MOCK_STATUS);
  private readonly summaryRow = signal<ReviewSummary | null>(null);
  private readonly techRows = signal<TechnicianRow[] | null>(null);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly reviews = this.store.asReadonly();
  readonly statuses = this.statusRows.asReadonly();
  readonly latestRepairs = signal<LatestRepair[]>(this.live ? [] : MOCK_LATEST);

  readonly needsReply = computed(() => this.store().filter((r) => !r.replyText).length);
  readonly totalRepairs = computed(() => this.statusRows().reduce((sum, s) => sum + s.repairCount, 0));
  readonly summary = computed<ReviewSummary>(() => {
    const fromDb = this.summaryRow();
    if (this.live && fromDb) return fromDb;
    const list = this.store();
    const stars: ReviewSummary['stars'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of list) stars[r.rating as 1 | 2 | 3 | 4 | 5]++;
    const avg = list.length ? list.reduce((sum, r) => sum + r.rating, 0) / list.length : null;
    return { totalReviews: list.length, averageRating: avg === null ? null : round2(avg), stars };
  });
  readonly technicians = computed<TechnicianRow[]>(() => {
    const fromDb = this.techRows();
    if (this.live && fromDb) return fromDb;
    return MOCK_TECHS.map((t) => {
      const mine = this.store().filter((r) => r.technicianName === t.technicianName);
      const avg = mine.length ? mine.reduce((sum, r) => sum + r.rating, 0) / mine.length : null;
      return { ...t, reviewCount: mine.length, averageRating: avg === null ? null : round2(avg) };
    });
  });

  async load(): Promise<void> {
    if (!this.live) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const db = this.db();
      const [reviewsRes, summaryRes, statusRes, techRes, latestRes] = await Promise.all([
        db.from('reviews').select('*').order('created_at', { ascending: false }),
        db.from('v_review_summary').select('*').maybeSingle(),
        db.from('v_repair_status_summary').select('*'),
        db.from('v_technician_performance').select('*'),
        db.from('repairs').select('id, device_brand, device_model, location, technician_id, status, created_at').order('created_at', { ascending: false }).limit(5),
      ]);
      for (const res of [reviewsRes, summaryRes, statusRes, techRes, latestRes]) {
        if (res.error) throw new Error(res.error.message);
      }
      const reviewRows = (reviewsRes.data ?? []) as ReviewRow[];

      const repairIds = reviewRows.map((r) => r.repair_id);
      const repairsRes = repairIds.length
        ? await db.from('repairs').select('id, device_brand, device_model, location, technician_id, status, created_at').in('id', repairIds)
        : { data: [] as RepairRow[], error: null };
      if (repairsRes.error) throw new Error(repairsRes.error.message);
      const repairMap = new Map(((repairsRes.data ?? []) as RepairRow[]).map((r) => [r.id, r]));

      const techsRes = await db.from('technicians').select('id, profile_id');
      const techRowsDb = (techsRes.data ?? []) as NameRow[];
      const profileIds = [...new Set([...techRowsDb.map((t) => t.profile_id ?? ''), ...reviewRows.map((r) => r.customer_id)].filter(Boolean))];
      const profilesRes = profileIds.length ? await db.from('profiles').select('id, full_name').in('id', profileIds) : { data: [] as NameRow[] };
      const profileName = new Map(((profilesRes.data ?? []) as NameRow[]).map((p) => [p.id, p.full_name ?? '']));
      const techName = new Map(techRowsDb.map((t) => [t.id, profileName.get(t.profile_id ?? '') || 'Technician']));

      this.store.set(
        reviewRows.map((r): AdminReview => {
          const rep = repairMap.get(r.repair_id);
          return {
            id: r.id, reviewId: r.review_id, rating: r.rating, comment: r.comment, createdAt: r.created_at,
            customerName: profileName.get(r.customer_id) || 'Customer',
            device: rep ? `${rep.device_brand} ${rep.device_model}` : 'Repair',
            location: rep?.location ?? '',
            technicianName: rep?.technician_id ? techName.get(rep.technician_id) ?? 'Technician' : 'Not assigned',
            replyText: r.reply_text, repliedAt: r.replied_at,
          };
        }),
      );
      const s = summaryRes.data as SummaryRow | null;
      this.summaryRow.set({
        totalReviews: s?.total_reviews ?? 0,
        averageRating: s?.average_rating == null ? null : Number(s.average_rating),
        stars: { 1: s?.star_1 ?? 0, 2: s?.star_2 ?? 0, 3: s?.star_3 ?? 0, 4: s?.star_4 ?? 0, 5: s?.star_5 ?? 0 },
      });
      this.statusRows.set(((statusRes.data ?? []) as StatusRow[]).map((r) => ({ status: label(r.status), repairCount: r.repair_count })));
      this.techRows.set(
        ((techRes.data ?? []) as TechRow[]).map((t) => ({
          technicianName: t.technician_name ?? 'Technician',
          totalRepairs: t.total_repairs, completedRepairs: t.completed_repairs, reviewCount: t.review_count,
          averageRating: t.average_rating == null ? null : Number(t.average_rating),
        })),
      );
      this.latestRepairs.set(
        ((latestRes.data ?? []) as RepairRow[]).map((r) => ({ id: r.id.slice(0, 8), device: `${r.device_brand} ${r.device_model}`, status: label(r.status), createdAt: r.created_at })),
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load the data.');
    } finally {
      this.loading.set(false);
    }
  }

  /** FSD 1.2: one reply per review. The database sets who replied and when. */
  async reply(id: string, text: string): Promise<void> {
    const clean = text.trim();
    if (!clean) throw new ReviewRuleError('A reply cannot be empty.');
    if (this.live) {
      const { data, error } = await this.db().from('reviews').update({ reply_text: clean }).eq('id', id).select('id');
      if (error) throw new ReviewRuleError(error.message);
      if (!data?.length) throw new ReviewRuleError('Only an administrator can reply to a review.');
      await this.load();
      return;
    }
    const review = this.store().find((r) => r.id === id);
    if (!review) throw new ReviewRuleError('Review not found.');
    if (review.replyText) throw new ReviewRuleError('This review already has a reply.');
    this.store.update((list) => list.map((r) => (r.id === id ? { ...r, replyText: clean, repliedAt: new Date().toISOString() } : r)));
  }

  /** FSD 1.5: an administrator deletes any review, any time (reply goes with it). */
  async remove(id: string): Promise<void> {
    if (this.live) {
      const { data, error } = await this.db().from('reviews').delete().eq('id', id).select('id');
      if (error) throw new ReviewRuleError(error.message);
      if (!data?.length) throw new ReviewRuleError('Only an administrator can delete this review.');
      await this.load();
      return;
    }
    this.store.update((list) => list.filter((r) => r.id !== id));
  }

  private db(): SupabaseClient {
    return getSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey) as unknown as SupabaseClient;
  }
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function label(status: string): string {
  const text = status.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
