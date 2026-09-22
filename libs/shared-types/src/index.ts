/**
 * KitaFix shared-types - the contract every team may import.
 *
 * database.generated.ts = raw `supabase gen types` output from the live project.
 * database.types.ts    = readable aliases used by the app.
 */
export * from './lib/database.types';

export type {
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from './lib/database.generated';
export { Constants } from './lib/database.generated';
