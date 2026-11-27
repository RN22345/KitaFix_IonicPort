/**
 * Data that Team 2 READS from other modules (never writes).
 * Shapes match the frozen contract in libs/shared-types.
 */

/** From Team 1 - technicians table, joined with profiles.full_name. */
export interface TechnicianOption {
  id: string;
  full_name: string;
  skills: string[];
  /** Average stars from Team 4's reviews (0094 get_technician_ratings); absent = no reviews yet. */
  rating?: number;
  review_count?: number;
}

/** One review as customers see it: anonymous (0094 get_public_reviews). */
export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  reply_text: string | null;
  created_at: string;
  service_name: string | null;
  technician_name: string | null;
}

/** From Team 3 - services table (shop menu and prices). */
export interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
}
