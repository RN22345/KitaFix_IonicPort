import { PublicReview } from '../../models/catalog.model';

/** .ts placeholder for get_public_reviews() (0094): anonymous, newest first. */
export const MOCK_PUBLIC_REVIEWS: PublicReview[] = [
  {
    id: 'r1000000-0000-4000-8000-000000000001',
    rating: 5,
    comment: 'Screen looks brand new and it was ready the same afternoon.',
    reply_text: 'Thank you! Enjoy the new screen.',
    created_at: '2026-11-25T09:30:00+08:00',
    service_name: 'Screen Replacement',
    technician_name: 'Marco Reyes',
  },
  {
    id: 'r1000000-0000-4000-8000-000000000002',
    rating: 4,
    comment: 'Battery lasts all day again. Waited a bit longer than quoted.',
    reply_text: null,
    created_at: '2026-11-22T14:10:00+08:00',
    service_name: 'Battery Replacement',
    technician_name: 'Marco Reyes',
  },
  {
    id: 'r1000000-0000-4000-8000-000000000003',
    rating: 5,
    comment: 'Charging port cleaned, phone charges fast now. Friendly staff.',
    reply_text: null,
    created_at: '2026-11-18T11:00:00+08:00',
    service_name: 'Charging Port Repair',
    technician_name: 'Dina Villanueva',
  },
];
