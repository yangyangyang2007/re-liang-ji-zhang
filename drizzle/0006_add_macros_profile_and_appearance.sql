ALTER TABLE meals ADD COLUMN total_carbs REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE meals ADD COLUMN total_fat REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN goal TEXT;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN experience TEXT;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN days_per_week INTEGER;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN equipment TEXT;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN theme_color TEXT;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN hero_art TEXT;
