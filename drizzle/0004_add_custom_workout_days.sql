CREATE TABLE workout_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  exercises_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE gym_sessions ADD COLUMN workout_day_id INTEGER;
--> statement-breakpoint
ALTER TABLE gym_sessions ADD COLUMN day_name TEXT;
--> statement-breakpoint
CREATE INDEX workout_days_created_idx ON workout_days (created_at);
