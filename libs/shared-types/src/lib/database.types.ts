/**
 * Shared types - THE TEAM CONTRACT (Module Plan v4, rule R4).
 *
 * `database.generated.ts` is the raw output of the Supabase type generator,
 * pulled straight from the live project:
 *
 *   npx supabase gen types typescript --project-id <ref> > libs/shared-types/src/lib/database.generated.ts
 *   (or GET https://api.supabase.com/v1/projects/<ref>/types/typescript)
 *
 * Regenerate it after every migration merge. Never edit it by hand.
 *
 * THIS file is the small convenience layer the app imports, so regenerating the
 * contract never breaks screen code. It also exposes short, readable aliases
 * (`RepairRow`, `RepairStatus`, ...) instead of deep `Database[...]` lookups.
 */
import type { Database, Json } from './database.generated';

export type { Database, Json } from './database.generated';

type PublicSchema = Database['public'];
type Tables = PublicSchema['Tables'];
type Enums = PublicSchema['Enums'];

/* -------------------------------------------------------------------------- */
/* Team 1 - Identity & People                                                 */
/* -------------------------------------------------------------------------- */

export type ProfileRow = Tables['profiles']['Row'];
export type ProfileInsert = Tables['profiles']['Insert'];
export type ProfileUpdate = Tables['profiles']['Update'];

export type TechnicianRow = Tables['technicians']['Row'];
export type TechnicianInsert = Tables['technicians']['Insert'];
export type TechnicianUpdate = Tables['technicians']['Update'];

/* -------------------------------------------------------------------------- */
/* Team 3 - Shop & Repair Operations                                          */
/* -------------------------------------------------------------------------- */

export type ServiceRow = Tables['services']['Row'];
export type ServiceInsert = Tables['services']['Insert'];
export type ServiceUpdate = Tables['services']['Update'];

/* -------------------------------------------------------------------------- */
/* Team 2 (booking columns) + Team 3 (workflow columns)                       */
/* -------------------------------------------------------------------------- */

/**
 * `booking_slot` is a database-internal generated column used only by the
 * availability exclusion constraint. No screen reads or writes it and the .ts
 * placeholder data must not carry it, so it is removed from the app-facing row.
 */
export type RepairRow = Omit<Tables['repairs']['Row'], 'booking_slot'>;
export type RepairInsert = Tables['repairs']['Insert'];
export type RepairUpdate = Tables['repairs']['Update'];

/* -------------------------------------------------------------------------- */
/* Frozen enums (rule R8: never invent values)                                */
/* -------------------------------------------------------------------------- */

export type RepairStatus = Enums['repair_status'];
export type UserRole = Enums['user_role'];
