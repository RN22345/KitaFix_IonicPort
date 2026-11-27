/** One review as the admin sees it (review + repair + names). */
export interface AdminReview {
  id: string;
  reviewId: string; // RV-00001
  rating: number; // 1 to 5
  comment: string | null;
  createdAt: string;
  customerName: string;
  device: string;
  location: string;
  technicianName: string;
  replyText: string | null;
  repliedAt: string | null;
}

export interface StatusCount { status: string; repairCount: number }

export interface TechnicianRow {
  technicianName: string;
  totalRepairs: number;
  completedRepairs: number;
  reviewCount: number;
  averageRating: number | null;
}

export interface ReviewSummary {
  totalReviews: number;
  averageRating: number | null;
  stars: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface LatestRepair { id: string; device: string; status: string; createdAt: string }
