DROP TABLE IF EXISTS entries;
--> statement-breakpoint
CREATE TABLE meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total_calories REAL NOT NULL,
  total_protein REAL NOT NULL,
  advice TEXT,
  photo_key TEXT,
  price_cents INTEGER,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  category TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  calorie_target INTEGER,
  protein_target INTEGER,
  spend_budget_cents INTEGER
);
--> statement-breakpoint
CREATE INDEX meals_date_idx ON meals (date);
--> statement-breakpoint
CREATE INDEX expenses_date_idx ON expenses (date);
