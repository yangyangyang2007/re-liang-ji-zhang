CREATE TABLE feedbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'suggestion',
  content TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX feedbacks_created_idx ON feedbacks (created_at);
