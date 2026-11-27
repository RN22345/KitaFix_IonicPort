/** A customer review of one completed repair (mirrors public.reviews). */
export interface Review {
  id: string;
  reviewId: string; // RV-00001
  repairId: string;
  rating: number; // 1 to 5
  comment: string | null; // up to 200 characters
  createdAt: string; // ISO date-time
  replyText: string | null; // the shop's single reply
  repliedAt: string | null;
}

/** The repair being reviewed (only the fields this page shows). */
export interface RepairInfo {
  id: string;
  device: string; // "Samsung Galaxy A54"
  location: string;
  status: string; // 'completed' is the only status that can be reviewed
}

/** FSD 1.5, 1.3, 1.4 */
export const MAX_COMMENT_LENGTH = 200;
export const EDIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Minutes the customer can still edit or delete (0 = locked). */
export function minutesLeft(review: Review, now = Date.now()): number {
  const left = new Date(review.createdAt).getTime() + EDIT_WINDOW_MS - now;
  return left > 0 ? Math.ceil(left / 60000) : 0;
}

export function starText(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export class ReviewRuleError extends Error {}
