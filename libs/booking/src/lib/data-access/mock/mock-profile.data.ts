import { CurrentUser } from '../../models/current-user.model';

/**
 * .ts placeholder for Team 1's profile of the signed-in user.
 * In mock mode this is the session the booking screens use.
 */
export const MOCK_CUSTOMER_ID = 'a1000000-0000-4000-8000-000000000001';

export const MOCK_CURRENT_USER: CurrentUser = {
  id: MOCK_CUSTOMER_ID,
  full_name: 'Alex Santos',
  email: 'customer@kitafix.test',
  role: 'customer',
};
