import { Injectable, inject, signal } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BOOKING_CONFIG, CurrentUserService, getSupabaseClient } from '@kitafix/booking';
import {
  EDIT_WINDOW_MS,
  MAX_COMMENT_LENGTH,
  RepairInfo,
  Review,
  ReviewRuleError,
} from '../models/review.model';

type Phase = 'loading' | 'ready' | 'error';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

/** Sample data used when environment.useMockData is true (no database needed). */
const MOCK_REPAIR: Omit<RepairInfo, 'id'> = { device: 'Samsung Galaxy A54', location: 'Main Branch - Downtown', status: 'completed' };
const MOCK_REVIEWS = new Map<string, Review>([
  ['demo-recent', { id: 'm1', reviewId: 'RV-00001', repairId: 'demo-recent', rating: 4, comment: 'Nice and clean work.', createdAt: minutesAgo(20), replyText: null, repliedAt: null }],
  ['demo-locked', { id: 'm2', reviewId: 'RV-00002', repairId: 'demo-locked', rating: 5, comment: 'Fast and friendly.', createdAt: minutesAgo(180), replyText: 'Thank you, see you again!', repliedAt: minutesAgo(120) }],
]);

interface ReviewRow { id: string; review_id: string; repair_id: string; rating: number; comment: string | null; created_at: string; reply_text: string | null; replied_at: string | null }
interface RepairRow { id: string; device_brand: string; device_model: string; location: string; status: string }

/**
 * Everything the "Leave a review" page needs. FSD rules 1.1, 1.3 to 1.5 are
 * enforced by the database (migration 0040); the sample-data mode repeats them
 * so the page behaves the same in an offline demo.
 */
@Injectable()
export class LeaveReviewService {
  private readonly config = inject(BOOKING_CONFIG);
  private readonly users = inject(CurrentUserService);
  private readonly live = !this.config.useMockData;

  readonly phase = signal<Phase>('loading');
  readonly error = signal<string | null>(null);
  readonly repair = signal<RepairInfo | null>(null);
  readonly review = signal<Review | null>(null);

  async load(repairId: string): Promise<void> {
    this.phase.set('loading');
    this.error.set(null);
    try {
      if (!this.live) {
        this.repair.set({ id: repairId, ...MOCK_REPAIR });
        this.review.set(MOCK_REVIEWS.get(repairId) ?? null);
        this.phase.set('ready');
        return;
      }
      const user = await this.users.load();
      const db = this.db();
      const repairRes = await db
        .from('repairs')
        .select('id, device_brand, device_model, location, status')
        .eq('id', repairId)
        .eq('customer_id', user.id)
        .maybeSingle();
      if (repairRes.error) throw new Error(repairRes.error.message);
      const row = repairRes.data as RepairRow | null;
      if (!row) {
        this.repair.set(null);
        this.phase.set('ready');
        return;
      }
      this.repair.set({ id: row.id, device: `${row.device_brand} ${row.device_model}`, location: row.location, status: row.status });

      const reviewRes = await db.from('reviews').select('*').eq('repair_id', repairId).maybeSingle();
      if (reviewRes.error) throw new Error(reviewRes.error.message);
      this.review.set(reviewRes.data ? toReview(reviewRes.data as ReviewRow) : null);
      this.phase.set('ready');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
      this.phase.set('error');
    }
  }

  /** FSD 1.1: own, completed repair only; rating 1 to 5; one review per repair. */
  async submit(rating: number, comment: string): Promise<void> {
    const repair = this.mustHaveRepair();
    this.validate(rating, comment);
    if (this.live) {
      const user = await this.users.load();
      const { error } = await this.db().from('reviews').insert({
        repair_id: repair.id,
        customer_id: user.id,
        rating,
        comment: comment.trim() || null,
      });
      if (error) throw new ReviewRuleError(explain(error));
      await this.load(repair.id);
      return;
    }
    if (repair.status !== 'completed') throw new ReviewRuleError('Only a completed repair can be reviewed.');
    if (this.review()) throw new ReviewRuleError('This repair already has a review.');
    const next: Review = { id: crypto.randomUUID(), reviewId: 'RV-' + String(MOCK_REVIEWS.size + 3).padStart(5, '0'), repairId: repair.id, rating, comment: comment.trim() || null, createdAt: new Date().toISOString(), replyText: null, repliedAt: null };
    MOCK_REVIEWS.set(repair.id, next);
    this.review.set(next);
  }

  /** FSD 1.3: only within 1 hour of creating the review. */
  async edit(rating: number, comment: string): Promise<void> {
    const current = this.mustHaveReview();
    this.validate(rating, comment);
    if (this.live) {
      const { data, error } = await this.db().from('reviews').update({ rating, comment: comment.trim() || null }).eq('id', current.id).select('id');
      if (error) throw new ReviewRuleError(explain(error));
      if (!data?.length) throw new ReviewRuleError('You can only edit your own review.');
      await this.load(current.repairId);
      return;
    }
    if (Date.now() > new Date(current.createdAt).getTime() + EDIT_WINDOW_MS) {
      throw new ReviewRuleError('Editing is only allowed within 1 hour of submitting the review.');
    }
    const next = { ...current, rating, comment: comment.trim() || null };
    MOCK_REVIEWS.set(current.repairId, next);
    this.review.set(next);
  }

  /** FSD 1.4: only within 1 hour. Also removes any shop reply. */
  async remove(): Promise<void> {
    const current = this.mustHaveReview();
    if (this.live) {
      const { data, error } = await this.db().from('reviews').delete().eq('id', current.id).select('id');
      if (error) throw new ReviewRuleError(explain(error));
      if (!data?.length) throw new ReviewRuleError('You can only delete your own review.');
      await this.load(current.repairId);
      return;
    }
    if (Date.now() > new Date(current.createdAt).getTime() + EDIT_WINDOW_MS) {
      throw new ReviewRuleError('This review can no longer be deleted by you. Ask an administrator to delete it.');
    }
    MOCK_REVIEWS.delete(current.repairId);
    this.review.set(null);
  }

  private db(): SupabaseClient {
    return getSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey) as unknown as SupabaseClient;
  }

  private validate(rating: number, comment: string): void {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ReviewRuleError('Please choose a rating from 1 to 5 stars.');
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
      throw new ReviewRuleError(`Comments can be at most ${MAX_COMMENT_LENGTH} characters.`);
    }
  }

  private mustHaveRepair(): RepairInfo {
    const repair = this.repair();
    if (!repair) throw new ReviewRuleError('This repair was not found.');
    return repair;
  }

  private mustHaveReview(): Review {
    const review = this.review();
    if (!review) throw new ReviewRuleError('There is no review to change.');
    return review;
  }
}

function toReview(row: ReviewRow): Review {
  return { id: row.id, reviewId: row.review_id, repairId: row.repair_id, rating: row.rating, comment: row.comment, createdAt: row.created_at, replyText: row.reply_text, repliedAt: row.replied_at };
}

/** Turns a database error into a sentence a customer can read. */
function explain(error: { message?: string; code?: string }): string {
  const message = error.message ?? '';
  if (error.code === '23505' && /duplicate key|unique/i.test(message)) return 'This repair already has a review.';
  if (error.code === '23514' && /check constraint/i.test(message)) {
    return 'Please check the rating (1 to 5) and keep the comment under 200 characters.';
  }
  return message || 'Something went wrong. Please try again.';
}
