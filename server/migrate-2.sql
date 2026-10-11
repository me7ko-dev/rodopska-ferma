-- Миграция 2 (12.10.2026): Родопски събор
ALTER TABLE users ADD COLUMN fair_week TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN fair_pts INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS users_fair ON users(fair_week, fair_pts DESC);
