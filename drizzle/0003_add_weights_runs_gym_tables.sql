CREATE TABLE weights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  weight_kg REAL NOT NULL,
  body_fat_pct REAL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  distance_km REAL NOT NULL,
  duration_min REAL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE gym_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  day_key TEXT NOT NULL,
  exercises_json TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX weights_date_idx ON weights (date);
--> statement-breakpoint
CREATE INDEX runs_date_idx ON runs (date);
--> statement-breakpoint
CREATE INDEX gym_sessions_date_idx ON gym_sessions (date);
