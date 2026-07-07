-- ============================================
-- RECOMMENDATION RULE KEY
-- ============================================
-- Lets the recommendation engine cron job (app/api/cron/recommendations)
-- dedupe against its own recent output reliably. The generated
-- `recommendation` text embeds computed numbers that shift slightly
-- between runs (correlation coefficients, sample means), so exact-text
-- matching would re-insert a near-duplicate every run; a stable per-rule
-- key (e.g. 'temperature_vs_dessert') lets the cron job check "have I
-- already told this restaurant about this pattern recently?" instead.
-- Nullable because manually-created recommendations (via the API/UI, not
-- the engine) have no rule behind them.

alter table recommendations add column rule_key text;

create index idx_recs_restaurant_rule on recommendations(restaurant_id, rule_key, timestamp desc);
