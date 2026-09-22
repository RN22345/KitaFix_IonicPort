/**
 * Data that Team 2 READS from other modules (never writes).
 * Shapes match the frozen contract in libs/shared-types.
 */

/** From Team 1 - technicians table, joined with profiles.full_name. */
export interface TechnicianOption {
  id: string;
  full_name: string;
  skills: string[];
}

/** From Team 3 - services table (shop menu and prices). */
export interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
}
