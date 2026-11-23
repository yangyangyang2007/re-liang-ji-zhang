// Actions for 热量记账 — a calorie/diet ledger plus a daily spending ledger.
//
// Photo flow: the client downscales a meal photo to ≤1024px JPEG base64 and
// calls analyzePhoto, which runs vision inference (ctx.inference) and stores
// the photo in ctx.blobs. Nothing is written to the DB until the user reviews
// the estimate and confirms via addMeal — AI numbers are always editable
// first. Expenses are purely manual, per the user's request.

import {
  defineAction,
  z,
  type ActionsModule,
  type Ctx,
} from "@hatch/space-sdk";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { privileged } from "@space/privileged";
import * as schema from "./schema";

// Daily targets are NOT defaulted: they come from the user's own quick
// calculation (Mifflin-St Jeor from their height/weight/age/sex/activity,
// minus ~300 kcal for fat loss; protein at 1.6–2.0 g per kg body weight)
// plus a daily spending quota the user sets themselves. Until the user
// runs that calculation, targets are null and the UI prompts for it.

export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;
export type ActivityLevel = keyof typeof ACTIVITY_FACTORS;

const mealItem = z.object({
  name: z.string(),
  portion: z.string(),
  calories: z.number(),
  protein: z.number(),
  // Carbs/fat default to 0 so rows logged before macro tracking (and
  // quick-add entries that omit them) still parse.
  carbs: z.number().default(0),
  fat: z.number().default(0),
});
type MealItem = z.infer<typeof mealItem>;

const mealOut = z.object({
  id: z.number(),
  date: z.string(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  items: z.array(mealItem),
  totalCalories: z.number(),
  totalProtein: z.number(),
  totalCarbs: z.number(),
  totalFat: z.number(),
  advice: z.string().nullable(),
  photoUrl: z.string().nullable(),
  priceCents: z.number().nullable(),
  createdAt: z.string(),
});

const expenseOut = z.object({
  id: z.number(),
  date: z.string(),
  amountCents: z.number(),
  category: z.enum(["food", "transport", "daily", "study", "fun", "other"]),
  note: z.string(),
  createdAt: z.string(),
});

const settingsOut = z.object({
  calorieTarget: z.number().nullable(),
  proteinTarget: z.number().nullable(),
  spendBudgetCents: z.number().nullable(),
  heightCm: z.number().nullable(),
  weightKg: z.number().nullable(),
  age: z.number().nullable(),
  sex: z.enum(["male", "female"]).nullable(),
  activityLevel: z
    .enum(["sedentary", "light", "moderate", "active", "very_active"])
    .nullable(),
  bmr: z.number().nullable(),
  tdee: z.number().nullable(),
  proteinMin: z.number().nullable(),
  proteinMax: z.number().nullable(),
  goal: z.enum(["fat_loss", "muscle", "shape", "strength"]).nullable(),
  experience: z.enum(["beginner", "some", "advanced"]).nullable(),
  daysPerWeek: z.number().nullable(),
  equipment: z.enum(["gym", "dumbbell", "bodyweight"]).nullable(),
  themeColor: z.string().nullable(),
  heroArt: z.string().nullable(),
});

type SettingsOut = z.infer<typeof settingsOut>;

// One exercise inside a user-built training day: picked from the exercise
// library by name, with the user's own sets and reps.
const planExercise = z.object({
  name: z.string().min(1).max(60),
  sets: z.number().int().min(1).max(20),
  reps: z.string().min(1).max(20),
});
type PlanExercise = z.infer<typeof planExercise>;

const workoutDayOut = z.object({
  id: z.number(),
  name: z.string(),
  exercises: z.array(planExercise),
  createdAt: z.string(),
});

// ---- Plan generation -------------------------------------------------
// The generator builds the user's customized three-split (三分化): Day 1
// 胸+三头, Day 2 背+二头, Day 3 肩+腹, with his established exercise picks
// at 4 sets each (see THREE_SPLIT below). Only the reps and the rest
// guidance follow his saved training goal. Names must match the
// client-side exercise library exactly so demos and videos resolve.

export const GOAL_CALORIE_DELTA = {
  fat_loss: -300,
  muscle: 250,
  shape: -100,
  strength: 100,
} as const;
export const GOAL_PROTEIN_PER_KG = {
  fat_loss: 2.2,
  muscle: 1.8,
  shape: 2.0,
  strength: 1.8,
} as const;

type GoalKey = keyof typeof GOAL_CALORIE_DELTA;
type ExperienceKey = "beginner" | "some" | "advanced";
type EquipmentKey = "gym" | "dumbbell" | "bodyweight";
type MuscleSlot =
  | "chest" | "back" | "legs" | "glutes"
  | "shoulders" | "biceps" | "triceps" | "core";

type CatalogEntry = {
  name: string;
  slot: MuscleSlot;
  equipment: EquipmentKey[];
  // Minimum experience index (0 beginner, 1 some base, 2 advanced).
  minLevel: 0 | 1 | 2;
  compound: boolean;
};

const PLAN_CATALOG: CatalogEntry[] = [
  // Chest
  { name: "杠铃平板卧推", slot: "chest", equipment: ["gym"], minLevel: 1, compound: true },
  { name: "坐姿推胸机", slot: "chest", equipment: ["gym"], minLevel: 0, compound: true },
  { name: "平板哑铃卧推", slot: "chest", equipment: ["gym", "dumbbell"], minLevel: 0, compound: true },
  { name: "上斜杠铃卧推", slot: "chest", equipment: ["gym"], minLevel: 1, compound: true },
  { name: "上斜哑铃卧推", slot: "chest", equipment: ["gym", "dumbbell"], minLevel: 0, compound: true },
  { name: "史密斯机卧推", slot: "chest", equipment: ["gym"], minLevel: 0, compound: true },
  { name: "俯卧撑", slot: "chest", equipment: ["gym", "dumbbell", "bodyweight"], minLevel: 0, compound: true },
  { name: "蝴蝶机夹胸", slot: "chest", equipment: ["gym"], minLevel: 0, compound: false },
  { name: "上斜哑铃飞鸟", slot: "chest", equipment: ["gym", "dumbbell"], minLevel: 1, compound: false },
  { name: "绳索夹胸", slot: "chest", equipment: ["gym"], minLevel: 0, compound: false },
  { name: "下斜哑铃卧推", slot: "chest", equipment: ["gym", "dumbbell"], minLevel: 2, compound: true },
  { name: "双杠臂屈伸", slot: "chest", equipment: ["gym"], minLevel: 2, compound: true },
  // Back
  { name: "高位下拉", slot: "back", equipment: ["gym"], minLevel: 0, compound: true },
  { name: "引体向上", slot: "back", equipment: ["gym", "bodyweight"], minLevel: 2, compound: true },
  { name: "杠铃划船", slot: "back", equipment: ["gym"], minLevel: 1, compound: true },
  { name: "杠铃硬拉", slot: "back", equipment: ["gym"], minLevel: 2, compound: true },
  { name: "坐姿划船", slot: "back", equipment: ["gym"], minLevel: 0, compound: true },
  { name: "单臂哑铃划船", slot: "back", equipment: ["gym", "dumbbell"], minLevel: 0, compound: true },
  { name: "T杠划船", slot: "back", equipment: ["gym"], minLevel: 1, compound: true },
  { name: "单臂绳索划船", slot: "back", equipment: ["gym"], minLevel: 0, compound: true },
  { name: "直臂下压", slot: "back", equipment: ["gym"], minLevel: 0, compound: false },
  { name: "山羊挺身", slot: "back", equipment: ["gym", "bodyweight"], minLevel: 0, compound: false },
  // Legs
  { name: "杠铃深蹲", slot: "legs", equipment: ["gym"], minLevel: 1, compound: true },
  { name: "高脚杯深蹲", slot: "legs", equipment: ["gym", "dumbbell"], minLevel: 0, compound: true },
  { name: "腿举机", slot: "legs", equipment: ["gym"], minLevel: 0, compound: true },
  { name: "罗马尼亚硬拉", slot: "legs", equipment: ["gym", "dumbbell"], minLevel: 1, compound: true },
  { name: "行走箭步蹲", slot: "legs", equipment: ["gym", "dumbbell", "bodyweight"], minLevel: 0, compound: true },
  { name: "保加利亚分腿蹲", slot: "legs", equipment: ["gym", "dumbbell", "bodyweight"], minLevel: 1, compound: true },
  { name: "自重深蹲", slot: "legs", equipment: ["gym", "dumbbell", "bodyweight"], minLevel: 0, compound: true },
  { name: "腿屈伸", slot: "legs", equipment: ["gym"], minLevel: 0, compound: false },
  { name: "俯卧腿弯举", slot: "legs", equipment: ["gym"], minLevel: 0, compound: false },
  { name: "站姿提踵", slot: "legs", equipment: ["gym", "dumbbell", "bodyweight"], minLevel: 0, compound: false },
  { name: "坐姿提踵", slot: "legs", equipment: ["gym"], minLevel: 0, compound: false },
  // Glutes
  { name: "杠铃臀推", slot: "glutes", equipment: ["gym"], minLevel: 1, compound: true },
  { name: "臀桥", slot: "glutes", equipment: ["gym", "dumbbell", "bodyweight"], minLevel: 0, compound: true },
  { name: "绳索后踢腿", slot: "glutes", equipment: ["gym"], minLevel: 0, compound: false },
  // Shoulders
  { name: "杠铃推举", slot: "shoulders", equipment: ["gym"], minLevel: 1, compound: true },
  { name: "坐姿推肩机", slot: "shoulders", equipment: ["gym"], minLevel: 0, compound: true },
  { name: "哑铃推举", slot: "shoulders", equipment: ["gym", "dumbbell"], minLevel: 0, compound: true },
  { name: "器械侧平举", slot: "shoulders", equipment: ["gym"], minLevel: 0, compound: false },
  { name: "哑铃侧平举", slot: "shoulders", equipment: ["gym", "dumbbell"], minLevel: 0, compound: false },
  { name: "哑铃前平举", slot: "shoulders", equipment: ["gym", "dumbbell"], minLevel: 0, compound: false },
  { name: "蝴蝶机反向飞鸟", slot: "shoulders", equipment: ["gym"], minLevel: 0, compound: false },
  { name: "俯身哑铃飞鸟", slot: "shoulders", equipment: ["gym", "dumbbell"], minLevel: 1, compound: false },
  { name: "面拉", slot: "shoulders", equipment: ["gym"], minLevel: 0, compound: false },
  // Biceps
  { name: "杠铃弯举", slot: "biceps", equipment: ["gym", "dumbbell"], minLevel: 0, compound: false },
  { name: "哑铃交替弯举", slot: "biceps", equipment: ["gym", "dumbbell"], minLevel: 0, compound: false },
  { name: "哑铃锤式弯举", slot: "biceps", equipment: ["gym", "dumbbell"], minLevel: 0, compound: false },
  { name: "器械弯举", slot: "biceps", equipment: ["gym"], minLevel: 0, compound: false },
  { name: "牧师凳弯举", slot: "biceps", equipment: ["gym"], minLevel: 1, compound: false },
  { name: "集中弯举", slot: "biceps", equipment: ["gym", "dumbbell"], minLevel: 1, compound: false },
  // Triceps
  { name: "龙门架绳索下压", slot: "triceps", equipment: ["gym"], minLevel: 0, compound: false },
  { name: "窄距卧推", slot: "triceps", equipment: ["gym"], minLevel: 1, compound: true },
  { name: "仰卧杠铃臂屈伸", slot: "triceps", equipment: ["gym", "dumbbell"], minLevel: 1, compound: false },
  { name: "绳索过头臂屈伸", slot: "triceps", equipment: ["gym"], minLevel: 0, compound: false },
  { name: "凳间臂屈伸", slot: "triceps", equipment: ["gym", "dumbbell", "bodyweight"], minLevel: 0, compound: false },
  // Core
  { name: "垫上卷腹", slot: "core", equipment: ["gym", "dumbbell", "bodyweight"], minLevel: 0, compound: false },
  { name: "平板支撑", slot: "core", equipment: ["gym", "dumbbell", "bodyweight"], minLevel: 0, compound: false },
  { name: "悬垂举腿", slot: "core", equipment: ["gym"], minLevel: 2, compound: false },
  { name: "俄罗斯转体抱片", slot: "core", equipment: ["gym", "dumbbell"], minLevel: 0, compound: false },
  { name: "死虫式", slot: "core", equipment: ["gym", "dumbbell", "bodyweight"], minLevel: 0, compound: false },
  { name: "健腹轮推出", slot: "core", equipment: ["gym", "dumbbell"], minLevel: 2, compound: false },
  { name: "登山跑", slot: "core", equipment: ["gym", "dumbbell", "bodyweight"], minLevel: 0, compound: false },
  { name: "自行车卷腹", slot: "core", equipment: ["gym", "dumbbell", "bodyweight"], minLevel: 0, compound: false },
];

// The user's customized three-split (三分化), the split he trains by:
// Day 1 胸+三头 (5 exercises), Day 2 背+二头 (5), Day 3 肩+腹 (6) — every
// exercise 4 sets, no leg day (legs are covered by his running and stairs).
// Exercise names are his established picks and must match the client-side
// exercise library exactly so demos and videos resolve.
const THREE_SPLIT: { name: string; focus: string; exercises: string[] }[] = [
  {
    name: "Day 1 · 胸 + 三头",
    focus: "胸 · 三头",
    exercises: ["坐姿推胸机", "蝴蝶机夹胸", "上斜哑铃卧推", "平板哑铃卧推", "龙门架绳索下压"],
  },
  {
    name: "Day 2 · 背 + 二头",
    focus: "背 · 二头",
    exercises: ["高位下拉", "坐姿划船", "单臂绳索划船", "器械弯举", "哑铃锤式弯举"],
  },
  {
    name: "Day 3 · 肩 + 腹",
    focus: "肩 · 腹",
    exercises: ["坐姿推肩机", "器械侧平举", "蝴蝶机反向飞鸟", "垫上卷腹", "俄罗斯转体抱片", "悬垂举腿"],
  },
];

const GOAL_SCHEMES: Record<
  GoalKey,
  { compoundSets: number; compoundReps: string; isoReps: string; restNote: string }
> = {
  fat_loss: {
    compoundSets: 3,
    compoundReps: "12",
    isoReps: "15",
    restNote: "组间休息 45–60 秒。动作之间尽量不拖长，整堂课控制在 60 分钟左右。",
  },
  muscle: {
    compoundSets: 4,
    compoundReps: "10",
    isoReps: "12",
    restNote: "复合动作组间休息 90 秒，孤立动作 60 秒；每组做到接近力竭（还剩 1–2 次余力），重量优先于速度，离心下放控制 2–3 秒。",
  },
  shape: {
    compoundSets: 3,
    compoundReps: "12",
    isoReps: "15",
    restNote: "组间休息 60 秒左右，重点放在动作幅度和顶端挤压上；每个动作最后一组可以做到力竭，感受目标肌群发力比冲重量更重要。",
  },
  strength: {
    compoundSets: 5,
    compoundReps: "5",
    isoReps: "10",
    restNote: "大重量复合动作组间休息 2–3 分钟，等呼吸和力量完全恢复再做下一组；辅助动作休息 60–90 秒。状态不好时宁可减重也不要硬顶。",
  },
};

function buildGeneratedPlan(profile: {
  goal: GoalKey;
  experience: ExperienceKey;
}): {
  splitLabel: string;
  restNote: string;
  days: { name: string; focus: string; exercises: PlanExercise[] }[];
} {
  // The split and exercise picks are the user's customized three-split
  // (THREE_SPLIT above): every exercise is 4 sets, as in his plan. Only the
  // reps follow his goal — compound scheme reps for compound movements,
  // isolation reps for the rest.
  const scheme = GOAL_SCHEMES[profile.goal];
  const compoundByName = new Map(PLAN_CATALOG.map((e) => [e.name, e.compound]));
  const days = THREE_SPLIT.map((day) => ({
    name: day.name,
    focus: day.focus,
    exercises: day.exercises.map((name) => ({
      name,
      sets: 4,
      reps: compoundByName.get(name) ? scheme.compoundReps : scheme.isoReps,
    })),
  }));
  const splitLabel = "三分化 · Day 1 胸+三头（20 组）/ Day 2 背+二头（20 组）/ Day 3 肩+腹（24 组）";
  const restNote =
    `${scheme.restNote} 三分化按练三休一滚动：连练 3 天（Day 1 → Day 2 → Day 3），第 4 天休息，4 天一个循环，不绑星期；漏练就顺延，不补双倍。` +
    (profile.experience === "beginner"
      ? "新手前两周先用轻重量把动作做标准，不加额外训练量。"
      : "如果某个肌群还在明显酸痛，把当天的训练顺延一天，不要硬练。");
  return { splitLabel, restNote, days };
}

function parsePlanExercises(json: string): PlanExercise[] {
  try {
    const parsed: unknown = JSON.parse(json);
    const result = z.array(planExercise).safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

async function loadSettings(ctx: Ctx): Promise<SettingsOut> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.id, 1))
    .limit(1);
  const row = rows[0];
  const weightKg = row?.weightKg ?? null;
  return {
    calorieTarget: row?.calorieTarget ?? null,
    proteinTarget: row?.proteinTarget ?? null,
    spendBudgetCents: row?.spendBudgetCents ?? null,
    heightCm: row?.heightCm ?? null,
    weightKg,
    age: row?.age ?? null,
    sex: row?.sex ?? null,
    activityLevel: row?.activityLevel ?? null,
    bmr: row?.bmr ?? null,
    tdee: row?.tdee ?? null,
    proteinMin: weightKg != null ? Math.round(weightKg * 1.6) : null,
    proteinMax: weightKg != null ? Math.round(weightKg * 2.0) : null,
    goal: row?.goal ?? null,
    experience: row?.experience ?? null,
    daysPerWeek: row?.daysPerWeek ?? null,
    equipment: row?.equipment ?? null,
    themeColor: row?.themeColor ?? null,
    heroArt: row?.heroArt ?? null,
  };
}

function parseItems(json: string): MealItem[] {
  try {
    const parsed: unknown = JSON.parse(json);
    const result = z.array(mealItem).safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

async function mealToOut(
  ctx: Ctx,
  row: typeof schema.meals.$inferSelect,
): Promise<z.infer<typeof mealOut>> {
  return {
    id: row.id,
    date: row.date,
    mealType: row.mealType,
    items: parseItems(row.itemsJson),
    totalCalories: row.totalCalories,
    totalProtein: row.totalProtein,
    totalCarbs: row.totalCarbs,
    totalFat: row.totalFat,
    advice: row.advice,
    photoUrl: row.photoKey ? await ctx.blobs.getUrl(row.photoKey) : null,
    priceCents: row.priceCents,
    createdAt: row.createdAt.toISOString(),
  };
}

const analysisSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        portion: z.string(),
        calories: z.number().min(0),
        protein: z.number().min(0),
        carbs: z.number().min(0),
        fat: z.number().min(0),
      }),
    )
    .min(1)
    .max(12),
  totalCalories: z.number().min(0),
  totalProtein: z.number().min(0),
  totalCarbs: z.number().min(0),
  totalFat: z.number().min(0),
  advice: z.string(),
});

const analysisResponse = z.object({
  ok: z.boolean(),
  photoKey: z.string().nullable(),
  items: z.array(mealItem),
  totalCalories: z.number(),
  totalProtein: z.number(),
  totalCarbs: z.number(),
  totalFat: z.number(),
  advice: z.string(),
  error: z.string().nullable(),
});

export const Actions = {
  getDay: defineAction({
    description:
      "Returns one day's meals, expenses, totals, and the user's daily targets.",
    request: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    response: z.object({
      meals: z.array(mealOut),
      expenses: z.array(expenseOut),
      totalCalories: z.number(),
      totalProtein: z.number(),
      totalCarbs: z.number(),
      totalFat: z.number(),
      totalSpendCents: z.number(),
      settings: settingsOut,
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const mealRows = await db
        .select()
        .from(schema.meals)
        .where(eq(schema.meals.date, args.date))
        .orderBy(desc(schema.meals.createdAt));
      const expenseRows = await db
        .select()
        .from(schema.expenses)
        .where(eq(schema.expenses.date, args.date))
        .orderBy(desc(schema.expenses.createdAt));
      const meals = await Promise.all(
        mealRows.map((row) => mealToOut(ctx, row)),
      );
      const mealSpend = mealRows.reduce(
        (sum, row) => sum + (row.priceCents ?? 0),
        0,
      );
      const expenseSpend = expenseRows.reduce(
        (sum, row) => sum + row.amountCents,
        0,
      );
      return {
        meals,
        expenses: expenseRows.map((row) => ({
          id: row.id,
          date: row.date,
          amountCents: row.amountCents,
          category: row.category,
          note: row.note,
          createdAt: row.createdAt.toISOString(),
        })),
        totalCalories: mealRows.reduce((s, r) => s + r.totalCalories, 0),
        totalProtein: mealRows.reduce((s, r) => s + r.totalProtein, 0),
        totalCarbs: mealRows.reduce((s, r) => s + r.totalCarbs, 0),
        totalFat: mealRows.reduce((s, r) => s + r.totalFat, 0),
        totalSpendCents: mealSpend + expenseSpend,
        settings: await loadSettings(ctx),
      };
    },
  }),

  analyzePhoto: defineAction({
    description:
      "Analyzes a meal photo with vision AI: identifies each dish and estimates calories and protein, returning an editable draft (nothing is saved).",
    request: z.object({
      imageBase64: z.string().min(100),
      mimeType: z.enum(["image/jpeg", "image/png"]),
    }),
    response: analysisResponse,
    privileged: [privileged.compressMealPhoto],
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof analysisResponse>> {
      // Server-side safety net: whatever the client sent (a multi-megabyte
      // PNG screenshot, an oversize JPEG), a privileged host helper
      // re-encodes it to a ≤768px JPEG before it reaches vision inference —
      // large images and PNG payloads are what made analyzePhoto fail. If
      // the re-encode itself fails we stop here with an honest error
      // instead of forwarding the original oversize bytes to inference.
      let jpegBytes: Buffer;
      let jpegBase64: string;
      try {
        const compressed = await ctx.executePrivileged(
          privileged.compressMealPhoto,
          { imageBase64: args.imageBase64 },
        );
        if (!compressed.ok || !compressed.jpegBase64) {
          throw new Error("photo compression failed");
        }
        jpegBase64 = compressed.jpegBase64;
        jpegBytes = Buffer.from(jpegBase64, "base64");
      } catch {
        return {
          ok: false,
          photoKey: null,
          items: [],
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFat: 0,
          advice: "",
          error:
            "这张照片处理不了，换一张 JPG 或 PNG 照片再试，或者手动记这一餐。",
        };
      }
      const photoKey = `meal-photos/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}.jpg`;
      await ctx.blobs.put(photoKey, jpegBytes, { contentType: "image/jpeg" });
      try {
        const result = await ctx.inference.complete(
          "识别这张食物照片中的每一样食物，估算每样的份量（中文，如\"1碗，约250克\"）、热量（大卡）、蛋白质（克）、碳水化合物（克）和脂肪（克），给出整餐总热量、总蛋白、总碳水和总脂肪，并给一句简短、具体的饮食建议（结合这餐的搭配说，不要空话）。各项数值按常见食堂/家常份量估算，宁可略保守。",
          {
            schema: analysisSchema,
            images: [
              {
                dataBase64: jpegBase64,
                mimeType: "image/jpeg",
                filename: "meal.jpg",
              },
            ],
            timeout_secs: 120,
          },
        );
        return {
          ok: true,
          photoKey,
          items: result.items,
          totalCalories: Math.round(result.totalCalories),
          totalProtein: Math.round(result.totalProtein * 10) / 10,
          totalCarbs: Math.round(result.totalCarbs * 10) / 10,
          totalFat: Math.round(result.totalFat * 10) / 10,
          advice: result.advice,
          error: null,
        };
      } catch {
        return {
          ok: false,
          photoKey,
          items: [],
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFat: 0,
          advice: "",
          error:
            "这张照片没认出来，换个角度或光线好一点再拍一次，或者手动记这一餐。",
        };
      }
    },
  }),

  addMeal: defineAction({
    description:
      "Saves a meal (from photo analysis or manual entry) after user review.",
    request: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      items: z.array(mealItem).min(1).max(20),
      advice: z.string().max(500).nullable().default(null),
      photoKey: z.string().nullable().default(null),
      priceCents: z.number().int().min(0).max(1_000_000).nullable().default(null),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const totalCalories = args.items.reduce((s, i) => s + i.calories, 0);
      const totalProtein = args.items.reduce((s, i) => s + i.protein, 0);
      const totalCarbs = args.items.reduce((s, i) => s + (i.carbs ?? 0), 0);
      const totalFat = args.items.reduce((s, i) => s + (i.fat ?? 0), 0);
      const result = await db
        .insert(schema.meals)
        .values({
          date: args.date,
          mealType: args.mealType,
          itemsJson: JSON.stringify(args.items),
          totalCalories,
          totalProtein,
          totalCarbs,
          totalFat,
          advice: args.advice,
          photoKey: args.photoKey,
          priceCents: args.priceCents,
        })
        .returning({ id: schema.meals.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addMeal: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  deleteMeal: defineAction({
    description: "Deletes one meal entry by id.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ photoKey: schema.meals.photoKey })
        .from(schema.meals)
        .where(eq(schema.meals.id, args.id))
        .limit(1);
      await db.delete(schema.meals).where(eq(schema.meals.id, args.id));
      const photoKey = rows[0]?.photoKey;
      if (photoKey) {
        await ctx.blobs.delete(photoKey).catch(() => undefined);
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addExpense: defineAction({
    description: "Adds one manually entered expense for a day.",
    request: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amountCents: z.number().int().positive().max(10_000_000),
      category: z.enum(["food", "transport", "daily", "study", "fun", "other"]),
      note: z.string().max(100).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.expenses)
        .values({
          date: args.date,
          amountCents: args.amountCents,
          category: args.category,
          note: args.note,
        })
        .returning({ id: schema.expenses.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addExpense: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  deleteExpense: defineAction({
    description: "Deletes one expense entry by id.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.expenses).where(eq(schema.expenses.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getHistory: defineAction({
    description:
      "Returns per-day calorie, protein, and spending summaries for the recent 60 days, newest first.",
    request: z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    response: z.object({
      days: z.array(
        z.object({
          date: z.string(),
          totalCalories: z.number(),
          totalProtein: z.number(),
          totalSpendCents: z.number(),
          mealCount: z.number(),
        }),
      ),
      settings: settingsOut,
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const range = and(
        gte(schema.meals.date, args.from),
        lte(schema.meals.date, args.to),
      );
      const mealRows = await db
        .select()
        .from(schema.meals)
        .where(range)
        .orderBy(desc(schema.meals.date));
      const expenseRows = await db
        .select()
        .from(schema.expenses)
        .where(
          and(
            gte(schema.expenses.date, args.from),
            lte(schema.expenses.date, args.to),
          ),
        );
      const byDate = new Map<
        string,
        {
          totalCalories: number;
          totalProtein: number;
          totalSpendCents: number;
          mealCount: number;
        }
      >();
      const bucket = (date: string) => {
        let b = byDate.get(date);
        if (!b) {
          b = {
            totalCalories: 0,
            totalProtein: 0,
            totalSpendCents: 0,
            mealCount: 0,
          };
          byDate.set(date, b);
        }
        return b;
      };
      for (const row of mealRows) {
        const b = bucket(row.date);
        b.totalCalories += row.totalCalories;
        b.totalProtein += row.totalProtein;
        b.totalSpendCents += row.priceCents ?? 0;
        b.mealCount += 1;
      }
      for (const row of expenseRows) {
        bucket(row.date).totalSpendCents += row.amountCents;
      }
      const days = [...byDate.entries()]
        .map(([date, b]) => ({ date, ...b }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      return { days, settings: await loadSettings(ctx) };
    },
  }),

  getSettings: defineAction({
    description: "Returns the user's daily calorie, protein, and spending targets.",
    request: z.object({}),
    response: settingsOut,
    async handler(ctx) {
      return loadSettings(ctx);
    },
  }),

  updateSettings: defineAction({
    description:
      "Updates the daily targets; send null for the spending budget to clear it.",
    request: z.object({
      calorieTarget: z.number().int().min(500).max(10000),
      proteinTarget: z.number().int().min(0).max(500),
      spendBudgetCents: z.number().int().min(0).max(10_000_000).nullable(),
    }),
    response: settingsOut,
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .insert(schema.settings)
        .values({
          id: 1,
          calorieTarget: args.calorieTarget,
          proteinTarget: args.proteinTarget,
          spendBudgetCents: args.spendBudgetCents,
        })
        .onConflictDoUpdate({
          target: schema.settings.id,
          set: {
            calorieTarget: args.calorieTarget,
            proteinTarget: args.proteinTarget,
            spendBudgetCents: args.spendBudgetCents,
          },
        });
      ctx.invalidateQueries();
      return loadSettings(ctx);
    },
  }),

  calculateTargets: defineAction({
    description:
      "Quick calculation: from the user's height, weight, age, sex, activity level and training goal, computes BMR (Mifflin-St Jeor), TDEE, the calorie target (goal-adjusted: fat loss −300, muscle +250, shape −100, strength +100) and the protein target (goal-dependent 1.8–2.2 g/kg); also stores the training profile (goal, experience, days per week, equipment) used by plan generation, plus the user's own daily spending quota.",
    request: z.object({
      heightCm: z.number().min(100).max(250),
      weightKg: z.number().min(30).max(300),
      age: z.number().int().min(10).max(100),
      sex: z.enum(["male", "female"]),
      activityLevel: z.enum([
        "sedentary",
        "light",
        "moderate",
        "active",
        "very_active",
      ]),
      spendBudgetCents: z.number().int().min(0).max(10_000_000).nullable(),
      goal: z
        .enum(["fat_loss", "muscle", "shape", "strength"])
        .nullable()
        .default(null),
      experience: z
        .enum(["beginner", "some", "advanced"])
        .nullable()
        .default(null),
      daysPerWeek: z.number().int().min(1).max(7).nullable().default(null),
      equipment: z
        .enum(["gym", "dumbbell", "bodyweight"])
        .nullable()
        .default(null),
    }),
    response: settingsOut,
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      // Mifflin-St Jeor
      const bmrRaw =
        10 * args.weightKg +
        6.25 * args.heightCm -
        5 * args.age +
        (args.sex === "male" ? 5 : -161);
      const factor = ACTIVITY_FACTORS[args.activityLevel];
      const tdeeRaw = bmrRaw * factor;
      const calorieTarget = Math.max(
        1200,
        Math.round(tdeeRaw + GOAL_CALORIE_DELTA[args.goal ?? "fat_loss"]),
      );
      const proteinTarget = Math.round(
        args.weightKg * GOAL_PROTEIN_PER_KG[args.goal ?? "fat_loss"],
      );
      const bmr = Math.round(bmrRaw);
      const tdee = Math.round(tdeeRaw);
      await db
        .insert(schema.settings)
        .values({
          id: 1,
          calorieTarget,
          proteinTarget,
          spendBudgetCents: args.spendBudgetCents,
          heightCm: args.heightCm,
          weightKg: args.weightKg,
          age: args.age,
          sex: args.sex,
          activityLevel: args.activityLevel,
          bmr,
          tdee,
          goal: args.goal,
          experience: args.experience,
          daysPerWeek: args.daysPerWeek,
          equipment: args.equipment,
        })
        .onConflictDoUpdate({
          target: schema.settings.id,
          set: {
            calorieTarget,
            proteinTarget,
            spendBudgetCents: args.spendBudgetCents,
            heightCm: args.heightCm,
            weightKg: args.weightKg,
            age: args.age,
            sex: args.sex,
            activityLevel: args.activityLevel,
            bmr,
            tdee,
            goal: args.goal,
            experience: args.experience,
            daysPerWeek: args.daysPerWeek,
            equipment: args.equipment,
          },
        });
      ctx.invalidateQueries();
      return loadSettings(ctx);
    },
  }),

  updateAppearance: defineAction({
    description:
      "Saves the user's appearance choices: theme accent color key and home hero artwork key.",
    request: z.object({
      themeColor: z.string().min(1).max(30),
      heroArt: z.string().min(1).max(30),
    }),
    response: settingsOut,
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .insert(schema.settings)
        .values({ id: 1, themeColor: args.themeColor, heroArt: args.heroArt })
        .onConflictDoUpdate({
          target: schema.settings.id,
          set: { themeColor: args.themeColor, heroArt: args.heroArt },
        });
      ctx.invalidateQueries();
      return loadSettings(ctx);
    },
  }),

  generatePlan: defineAction({
    description:
      "Generates the user's customized three-split training plan (Day 1 胸+三头, Day 2 背+二头, Day 3 肩+腹, every exercise 4 sets, reps by the saved training goal): replaces all current training days and returns a summary with the split structure and 练三休一 rest guidance. The user can edit the result freely afterwards.",
    request: z.object({}),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      splitLabel: z.string(),
      restNote: z.string(),
      days: z.array(
        z.object({
          name: z.string(),
          focus: z.string(),
          exercises: z.array(
            z.object({ name: z.string(), sets: z.number(), reps: z.string() }),
          ),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const settings = await loadSettings(ctx);
      if (!settings.goal || !settings.experience) {
        return {
          ok: false,
          error:
            "先在上面把目标和训练经验选好，并点「计算并设为我的目标」保存，再来生成三分化计划。",
          splitLabel: "",
          restNote: "",
          days: [],
        };
      }
      const plan = buildGeneratedPlan({
        goal: settings.goal,
        experience: settings.experience,
      });
      await db.delete(schema.workoutDays);
      for (const day of plan.days) {
        await db.insert(schema.workoutDays).values({
          name: day.name,
          exercisesJson: JSON.stringify(day.exercises),
        });
      }
      ctx.invalidateQueries();
      return {
        ok: true,
        error: null,
        splitLabel: plan.splitLabel,
        restNote: plan.restNote,
        days: plan.days,
      };
    },
  }),

  getWeights: defineAction({
    description: "Returns weight entries for the last 120 days, newest first.",
    request: z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    response: z.object({
      entries: z.array(
        z.object({
          id: z.number(),
          date: z.string(),
          weightKg: z.number(),
          bodyFatPct: z.number().nullable(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.weights)
        .where(and(gte(schema.weights.date, args.from), lte(schema.weights.date, args.to)))
        .orderBy(desc(schema.weights.date));
      return {
        entries: rows.map((r) => ({
          id: r.id,
          date: r.date,
          weightKg: r.weightKg,
          bodyFatPct: r.bodyFatPct,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  upsertWeight: defineAction({
    description: "Creates or updates the morning weight for a date.",
    request: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      weightKg: z.number().min(30).max(200),
      bodyFatPct: z.number().min(3).max(60).nullable().default(null),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .insert(schema.weights)
        .values({ date: args.date, weightKg: args.weightKg, bodyFatPct: args.bodyFatPct })
        .onConflictDoUpdate({
          target: schema.weights.date,
          set: { weightKg: args.weightKg, bodyFatPct: args.bodyFatPct },
        });
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteWeight: defineAction({
    description: "Deletes one weight entry by id.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.weights).where(eq(schema.weights.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getFitness: defineAction({
    description: "Returns gym check-ins for the user's training plan.",
    request: z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    response: z.object({
      gymSessions: z.array(
        z.object({
          id: z.number(),
          date: z.string(),
          workoutDayId: z.number().nullable(),
          dayName: z.string().nullable(),
          exercises: z.array(
            z.object({
              name: z.string(),
              done: z.boolean(),
              sets: z.number().nullable(),
              reps: z.string().nullable(),
            }),
          ),
          note: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const gymRows = await db
        .select()
        .from(schema.gymSessions)
        .where(and(gte(schema.gymSessions.date, args.from), lte(schema.gymSessions.date, args.to)))
        .orderBy(desc(schema.gymSessions.date), desc(schema.gymSessions.createdAt));
      return {
        gymSessions: gymRows.map((r) => {
          let exercises: {
            name: string;
            done: boolean;
            sets: number | null;
            reps: string | null;
          }[] = [];
          try {
            const parsed: unknown = JSON.parse(r.exercisesJson);
            const res = z
              .array(
                z.object({
                  name: z.string(),
                  done: z.boolean(),
                  sets: z.number().nullable().optional(),
                  reps: z.string().nullable().optional(),
                }),
              )
              .safeParse(parsed);
            if (res.success)
              exercises = res.data.map((e) => ({
                name: e.name,
                done: e.done,
                sets: e.sets ?? null,
                reps: e.reps ?? null,
              }));
          } catch { /* keep empty */ }
          return {
            id: r.id,
            date: r.date,
            workoutDayId: r.workoutDayId,
            // Legacy rows (before custom plans) have no day_name; fall back
            // to a neutral label so old check-ins stay readable.
            dayName: r.dayName ?? "健身打卡",
            exercises,
            note: r.note,
            createdAt: r.createdAt.toISOString(),
          };
        }),
      };
    },
  }),

  addGymSession: defineAction({
    description:
      "Saves a gym check-in for one of the user's own training days, with per-exercise completion.",
    request: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      workoutDayId: z.number().int().positive().nullable().default(null),
      dayName: z.string().min(1).max(60),
      exercises: z
        .array(
          z.object({
            name: z.string(),
            done: z.boolean(),
            sets: z.number().int().min(1).max(20).nullable().default(null),
            reps: z.string().max(20).nullable().default(null),
          }),
        )
        .min(1)
        .max(20),
      note: z.string().max(200).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.gymSessions)
        .values({
          date: args.date,
          dayKey: "custom",
          workoutDayId: args.workoutDayId,
          dayName: args.dayName,
          exercisesJson: JSON.stringify(args.exercises),
          note: args.note,
        })
        .returning({ id: schema.gymSessions.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addGymSession: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  deleteGymSession: defineAction({
    description: "Deletes one gym session by id.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.gymSessions).where(eq(schema.gymSessions.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getWorkoutPlan: defineAction({
    description:
      "Returns the user's own training plan: their named training days and the exercises they picked for each, in creation order.",
    request: z.object({}),
    response: z.object({ days: z.array(workoutDayOut) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.workoutDays)
        .orderBy(schema.workoutDays.id);
      return {
        days: rows.map((r) => ({
          id: r.id,
          name: r.name,
          exercises: parsePlanExercises(r.exercisesJson),
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  createWorkoutDay: defineAction({
    description: "Creates a new empty training day with a user-chosen name.",
    request: z.object({ name: z.string().trim().min(1).max(30) }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.workoutDays)
        .values({ name: args.name, exercisesJson: "[]" })
        .returning({ id: schema.workoutDays.id });
      const inserted = result[0];
      if (!inserted) throw new Error("createWorkoutDay: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateWorkoutDay: defineAction({
    description:
      "Renames a training day and/or replaces its exercise list (picked exercises with sets and reps).",
    request: z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(1).max(30),
      exercises: z.array(planExercise).max(20),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.workoutDays)
        .set({ name: args.name, exercisesJson: JSON.stringify(args.exercises) })
        .where(eq(schema.workoutDays.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteWorkoutDay: defineAction({
    description:
      "Deletes one of the user's training days from their plan. Past check-ins keep their day-name snapshot.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.workoutDays)
        .where(eq(schema.workoutDays.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  submitFeedback: defineAction({
    description:
      "Saves one user suggestion / feedback entry (category, content, optional contact) so the user can submit ideas, bug reports, or experience feedback from inside the app.",
    request: z.object({
      category: z
        .enum(["suggestion", "bug", "experience", "other"])
        .default("suggestion"),
      content: z.string().trim().min(1).max(1000),
      contact: z.string().trim().max(100).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.feedbacks)
        .values({
          category: args.category,
          content: args.content,
          contact: args.contact,
        })
        .returning({ id: schema.feedbacks.id });
      const inserted = result[0];
      if (!inserted) throw new Error("submitFeedback: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  getFeedbacks: defineAction({
    description:
      "Returns the user's submitted feedback entries, newest first (up to 50).",
    request: z.object({}),
    response: z.object({
      feedbacks: z.array(
        z.object({
          id: z.number(),
          category: z.enum(["suggestion", "bug", "experience", "other"]),
          content: z.string(),
          contact: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.feedbacks)
        .orderBy(desc(schema.feedbacks.createdAt))
        .limit(50);
      return {
        feedbacks: rows.map((r) => ({
          id: r.id,
          category: r.category,
          content: r.content,
          contact: r.contact,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  deleteFeedback: defineAction({
    description: "Deletes one feedback entry by id.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.feedbacks)
        .where(eq(schema.feedbacks.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),
} satisfies ActionsModule;
