# Reviewer guide

Thanks for the review. The module rules live in
[`docs/KitaFix_Module_Plan_v4.md`](../docs/KitaFix_Module_Plan_v4.md) (rules R1-R10).

## Quick check for the reviewer

- [ ] Only the owning team's library and tables were touched (R1).
- [ ] New database changes are in a `NNNN_teamN_*.sql` migration (R2).
- [ ] RLS policies exist for any new table (Definition of Done).
- [ ] No deep imports into another team's library; only `@kitafix/shared-types`
      and the other module's barrel are used (R6).
- [ ] Status values come from the `repair_status` enum only (R8).
- [ ] TypeScript contract (`libs/shared-types`) changes were regenerated, not hand-edited.
- [ ] CI build is green.
