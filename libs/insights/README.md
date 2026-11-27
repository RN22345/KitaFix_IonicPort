# libs/insights (Team 4 - Feedback & Insights)

CUSTOMER  (inside the customer tabs, no tab added)
  /tabs/leave-review/<repair id>   Leave a review: rating 1-5 + optional comment (max 200),
                                   completed repairs of your own only, one review per repair,
                                   edit / delete within 1 hour, the shop's single reply is shown.

ADMIN  (own small tab bar (Overview, Insights) at /staff, customer tabs are never touched)
  2 tabs, 3 screens:
  /admin/overview   Overview tab: repair counts, rating line, latest repairs
  /admin/insights   Insights tab with a Reviews | Reports toggle:
                      Reviews = all reviews, search + star filter, reply once, delete (confirm)
                      Reports = repairs per status, rating breakdown, technician performance
                    (/admin/insights?view=reports opens the Reports side)

Who may open /staff (login + role check) is Team 1's job. The database still applies its own rules.

Data: public.reviews + 3 views (supabase/migrations/0040_team4_insights.sql).
useMockData: true  -> sample data, nothing saved.   false -> Supabase.

Shared files touched, one entry each:
  tsconfig.json          path alias @kitafix/insights
  src/app/app.routes.ts  one entry inside /tabs children (customer page) + one top-level 'staff' entry
