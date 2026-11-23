// Drizzle schema for 热量记账 (calorie & spending ledger).
//
// meals    — one row per logged meal (photo-analyzed or manual), with the
//            item breakdown kept as JSON text, the AI advice captured at
//            analysis time, and an optional photo blob key.
// expenses — one row per manually entered expense, amount in cents.
// settings — single-row table (id = 1) holding the user's daily targets;
//            a null target means "not set" (defaults are applied by actions).

import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const meals = sqliteTable("meals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Local calendar date (Asia/Shanghai) the meal belongs to, YYYY-MM-DD.
  date: text("date").notNull(),
  mealType: text("meal_type", {
    enum: ["breakfast", "lunch", "dinner", "snack"],
  }).notNull(),
  // JSON array of { name, portion, calories, protein }.
  itemsJson: text("items_json").notNull(),
  totalCalories: real("total_calories").notNull(),
  totalProtein: real("total_protein").notNull(),
  advice: text("advice"),
  photoKey: text("photo_key"),
  // What this meal cost, in cents; also counted into the day's spending.
  priceCents: integer("price_cents"),
  // Daily macro totals (grams) alongside calories/protein; 0 for rows
  // logged before macros were tracked.
  totalCarbs: real("total_carbs").notNull().default(0),
  totalFat: real("total_fat").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  amountCents: integer("amount_cents").notNull(),
  category: text("category", {
    enum: ["food", "transport", "daily", "study", "fun", "other"],
  }).notNull(),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  calorieTarget: integer("calorie_target"),
  proteinTarget: integer("protein_target"),
  spendBudgetCents: integer("spend_budget_cents"),
  // Personal basics for the target calculator (Mifflin-St Jeor). All null
  // until the user enters them and runs the calculation.
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  age: integer("age"),
  sex: text("sex", { enum: ["male", "female"] }),
  activityLevel: text("activity_level", {
    enum: ["sedentary", "light", "moderate", "active", "very_active"],
  }),
  bmr: real("bmr"),
  tdee: real("tdee"),
  // Training profile for plan generation (all null until the user fills
  // them in on the 目标 page).
  goal: text("goal", { enum: ["fat_loss", "muscle", "shape", "strength"] }),
  experience: text("experience", {
    enum: ["beginner", "some", "advanced"],
  }),
  daysPerWeek: integer("days_per_week"),
  equipment: text("equipment", { enum: ["gym", "dumbbell", "bodyweight"] }),
  // Appearance: theme accent color key + home hero artwork key.
  themeColor: text("theme_color"),
  heroArt: text("hero_art"),
});

export const weights = sqliteTable("weights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  weightKg: real("weight_kg").notNull(),
  bodyFatPct: real("body_fat_pct"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const runs = sqliteTable("runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  distanceKm: real("distance_km").notNull(),
  durationMin: real("duration_min"),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const gymSessions = sqliteTable("gym_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  // Legacy rows store 'day1'|'day2'|'day3'; new check-ins store 'custom'.
  dayKey: text("day_key").notNull(),
  // The user's own training day this check-in came from (null for legacy).
  workoutDayId: integer("workout_day_id"),
  // Snapshot of the training day's name at check-in time.
  dayName: text("day_name"),
  // JSON array of { name, done, sets?, reps? }
  exercisesJson: text("exercises_json").notNull(),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// The user's own training plan: they create named training days and fill
// each one with exercises picked from the library, with their own sets/reps.
// exercisesJson is a JSON array of { name, sets, reps }.
export const workoutDays = sqliteTable("workout_days", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  exercisesJson: text("exercises_json").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// User-submitted suggestions / feedback. One row per submission; the user
// can review and delete their own submissions in the app.
export const feedbacks = sqliteTable("feedbacks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category", {
    enum: ["suggestion", "bug", "experience", "other"],
  })
    .notNull()
    .default("suggestion"),
  content: text("content").notNull(),
  contact: text("contact").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
