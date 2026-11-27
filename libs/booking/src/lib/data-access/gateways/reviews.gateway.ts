import { Injectable, inject } from '@angular/core';
import { PublicReview } from '../../models/catalog.model';
import { BOOKING_CONFIG } from '../config';
import { MOCK_PUBLIC_REVIEWS } from '../mock/mock-reviews.data';
import { mapPostgrestError } from '../postgrest-errors';
import { getSupabaseClient } from '../supabase-client';

/**
 * Team 2 READS Team 4's reviews, anonymously, through two database functions
 * (migration 0094). Nothing here identifies the customer who wrote a review.
 */
export abstract class ReviewsGateway {
  abstract recent(limit: number): Promise<PublicReview[]>;
  /** technician id -> { rating, review_count } */
  abstract technicianRatings(): Promise<Map<string, { rating: number; review_count: number }>>;
}

@Injectable()
export class MockReviewsGateway extends ReviewsGateway {
  async recent(limit: number): Promise<PublicReview[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return MOCK_PUBLIC_REVIEWS.slice(0, limit).map((review) => ({ ...review }));
  }

  async technicianRatings(): Promise<Map<string, { rating: number; review_count: number }>> {
    return new Map([
      ['b1000000-0000-4000-8000-000000000001', { rating: 4.8, review_count: 12 }],
      ['b1000000-0000-4000-8000-000000000002', { rating: 4.5, review_count: 7 }],
    ]);
  }
}

@Injectable()
export class SupabaseReviewsGateway extends ReviewsGateway {
  private readonly config = inject(BOOKING_CONFIG);

  async recent(limit: number): Promise<PublicReview[]> {
    const db = getSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
    const { data, error } = await db.rpc('get_public_reviews', { p_limit: limit });
    if (error) throw mapPostgrestError(error);
    return ((data ?? []) as PublicReview[]).map((row) => ({ ...row, rating: Number(row.rating) }));
  }

  async technicianRatings(): Promise<Map<string, { rating: number; review_count: number }>> {
    const db = getSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
    const { data, error } = await db.rpc('get_technician_ratings');
    if (error) throw mapPostgrestError(error);
    const rows = (data ?? []) as { technician_id: string; review_count: number; average_rating: number | string }[];
    return new Map(rows.map((row) => [row.technician_id, { rating: Number(row.average_rating), review_count: row.review_count }]));
  }
}
