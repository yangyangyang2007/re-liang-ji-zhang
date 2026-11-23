// 热量记账 — photo-first calorie ledger + manual daily spending ledger.
//
// Today view: remaining calories as the hero figure, protein and spending
// progress rules, the day's meals (with photos and AI advice) and expenses.
// Meals are added by photo (vision AI estimate, reviewed before saving) or
// manually (with the user's own quick-add foods). Expenses are manual only,
// judged against a daily target the user sets in the 目标 tab.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim, fileToBase64 } from "@hatch/space-sdk/client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { api, type ApiResponse } from "./api";
import {
  EXERCISE_LIBRARY,
  MUSCLE_FILTERS,
  exerciseByName,
  type Exercise,
} from "./exercises";
import heroBarbell from "./assets/hero-barbell.webp";
import heroDumbbell from "./assets/hero-dumbbell.webp";
import heroKettlebell from "./assets/hero-kettlebell.webp";

// Theme colors the user can switch between; picking one re-skins the whole
// UI because every component reads --accent / --accent-soft.
const THEME_OPTIONS: { key: string; label: string; accent: string; soft: string }[] = [
  { key: "red", label: "烈焰红", accent: "#e8323f", soft: "rgba(232,50,63,0.16)" },
  { key: "blue", label: "电光蓝", accent: "#2f7df6", soft: "rgba(47,125,246,0.16)" },
  { key: "green", label: "力量绿", accent: "#2fbf71", soft: "rgba(47,191,113,0.16)" },
  { key: "purple", label: "电紫", accent: "#9b5cf6", soft: "rgba(155,92,246,0.16)" },
  { key: "orange", label: "活力橙", accent: "#f2762e", soft: "rgba(242,118,46,0.16)" },
];
function themeByKey(key: string | null | undefined) {
  return THEME_OPTIONS.find((t) => t.key === key) ?? THEME_OPTIONS[0]!;
}
// Original dark sport artwork for the home hero card (AI-generated for
// this app — no copied characters).
const HERO_ART_OPTIONS: { key: string; label: string; img: string }[] = [
  { key: "barbell", label: "杠铃硬拉", img: heroBarbell },
  { key: "dumbbell", label: "哑铃握力", img: heroDumbbell },
  { key: "kettlebell", label: "壶铃摆动", img: heroKettlebell },
];
function heroArtByKey(key: string | null | undefined) {
  return HERO_ART_OPTIONS.find((a) => a.key === key) ?? HERO_ART_OPTIONS[0]!;
}

type DayData = ApiResponse<typeof api, "getDay">;
type Meal = DayData["meals"][number];
type DaySettings = DayData["settings"];
type HistoryData = ApiResponse<typeof api, "getHistory">;

type MealTypeKey = Meal["mealType"];
type CategoryKey = DayData["expenses"][number]["category"];

const MEAL_TYPES: { key: MealTypeKey; label: string }[] = [
  { key: "breakfast", label: "早餐" },
  { key: "lunch", label: "午餐" },
  { key: "dinner", label: "晚餐" },
  { key: "snack", label: "加餐" },
];

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "food", label: "餐饮" },
  { key: "transport", label: "交通" },
  { key: "daily", label: "日用" },
  { key: "study", label: "学习" },
  { key: "fun", label: "娱乐" },
  { key: "other", label: "其他" },
];

function mealTypeLabel(key: MealTypeKey): string {
  return MEAL_TYPES.find((t) => t.key === key)?.label ?? key;
}
function categoryLabel(key: CategoryKey): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

type FeedbackCategory = "suggestion" | "bug" | "experience" | "other";
const FEEDBACK_CATEGORIES: { key: FeedbackCategory; label: string; hint: string }[] = [
  { key: "suggestion", label: "功能建议", hint: "想要什么新功能，直接说" },
  { key: "bug", label: "问题反馈", hint: "哪里不好用、报错了" },
  { key: "experience", label: "使用体验", hint: "用着别扭、不顺手的地方" },
  { key: "other", label: "其他", hint: "其他想说的" },
];
function feedbackCategoryLabel(key: FeedbackCategory): string {
  return FEEDBACK_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

// Quick-add foods — common, generic foods with standard reference values
// for a typical portion (cooked weights where relevant). All values are
// estimates the user can edit before saving; nothing here is based on any
// one person's diet.
type QuickFood = { name: string; portion: string; calories: number; protein: number; carbs: number; fat: number; cat: string };
const QUICK_FOODS: QuickFood[] = [
  { name: "米饭", portion: "1碗，约200克", calories: 230, protein: 5, carbs: 52, fat: 0.5, cat: "主食" },
  { name: "面条", portion: "1碗（煮熟），约200克", calories: 220, protein: 7, carbs: 44, fat: 1.5, cat: "主食" },
  { name: "馒头", portion: "1个，约100克", calories: 220, protein: 7, carbs: 47, fat: 1, cat: "主食" },
  { name: "面包", portion: "2片，约60克", calories: 150, protein: 5, carbs: 26, fat: 2, cat: "主食" },
  { name: "鸡蛋", portion: "1个，约50克", calories: 70, protein: 6.5, carbs: 0.5, fat: 5, cat: "蛋白" },
  { name: "鸡胸肉", portion: "100克（熟）", calories: 165, protein: 31, carbs: 0, fat: 3.5, cat: "蛋白" },
  { name: "牛肉", portion: "100克（瘦，熟）", calories: 250, protein: 26, carbs: 0, fat: 15, cat: "蛋白" },
  { name: "猪肉", portion: "100克（瘦，熟）", calories: 240, protein: 27, carbs: 0, fat: 14, cat: "蛋白" },
  { name: "鱼肉", portion: "100克（熟）", calories: 120, protein: 20, carbs: 0, fat: 4, cat: "蛋白" },
  { name: "虾", portion: "100克", calories: 100, protein: 21, carbs: 1, fat: 1, cat: "蛋白" },
  { name: "豆腐", portion: "100克", calories: 80, protein: 8, carbs: 2, fat: 4, cat: "蛋白" },
  { name: "牛奶", portion: "1盒 250ml", calories: 160, protein: 8, carbs: 12, fat: 9, cat: "蛋白" },
  { name: "酸奶", portion: "1杯，约200克", calories: 140, protein: 6, carbs: 18, fat: 5, cat: "蛋白" },
  { name: "苹果", portion: "1个", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, cat: "蔬果" },
  { name: "香蕉", portion: "1根", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, cat: "蔬果" },
  { name: "蔬菜沙拉", portion: "1份，约150克", calories: 60, protein: 2, carbs: 9, fat: 1.5, cat: "蔬果" },
];
const QUICK_CATS = ["主食", "蛋白", "蔬果"] as const;

type PlanExerciseDraft = { name: string; sets: number; reps: string };
type WorkoutDayDraft = { name: string; exercises: PlanExerciseDraft[] };

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayKey(): string {
  return toKey(new Date());
}
function shiftKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toKey(d);
}
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
function prettyDate(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()] ?? ""}`;
}
function dayLabel(key: string): string {
  const t = todayKey();
  if (key === t) return "今天";
  if (key === shiftKey(t, -1)) return "昨天";
  return prettyDate(key);
}
function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtMoney(cents: number): string {
  const v = cents / 100;
  return `¥${Number.isInteger(v) ? v : v.toFixed(2)}`;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function guessMealType(): MealTypeKey {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

// Decode a picked photo and re-encode it as a ≤1024px JPEG before upload.
// createImageBitmap is the fast path, but some phone browsers/WebViews
// throw or return nothing for certain photos — when that happens we fall
// back to decoding through an <img> element with an object URL, which
// handles the same JPEG/PNG files through a different code path. If both
// paths fail we throw a real, user-readable error instead of leaving the
// UI stuck on "analyzing".
async function decodeWithImg(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("img decode failed"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

async function fileToJpeg(file: File): Promise<{ dataBase64: string; previewUrl: string }> {
  let source: CanvasImageSource;
  let srcW = 0;
  let srcH = 0;
  let cleanup: () => void = () => undefined;
  try {
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    srcW = bitmap.width;
    srcH = bitmap.height;
    cleanup = () => bitmap.close();
  } catch {
    const decoded = await decodeWithImg(file).catch(() => null);
    if (!decoded) {
      throw new Error(
        "这张照片打不开，换一张 JPG 或 PNG 照片再试，或者手动记这一餐。",
      );
    }
    source = decoded.source;
    srcW = decoded.width;
    srcH = decoded.height;
    cleanup = decoded.cleanup;
  }
  try {
    if (!srcW || !srcH) {
      throw new Error(
        "这张照片打不开，换一张 JPG 或 PNG 照片再试，或者手动记这一餐。",
      );
    }
    const max = 1024;
    const scale = Math.min(1, max / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const cx = canvas.getContext("2d");
    if (!cx) {
      throw new Error("这张照片处理不了，换一张照片再试，或者手动记这一餐。");
    }
    cx.drawImage(source, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.85),
    );
    if (!blob) {
      throw new Error("这张照片处理不了，换一张照片再试，或者手动记这一餐。");
    }
    const { dataBase64 } = await fileToBase64(blob);
    return { dataBase64, previewUrl: URL.createObjectURL(blob) };
  } finally {
    cleanup();
  }
}

function ProgressRule(props: {
  label: string;
  valueText: string;
  pct: number | null;
  over?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-[var(--dim)]">{props.label}</span>
        <span
          className={`text-sm font-medium tabular-nums ${
            props.over ? "text-[var(--danger)]" : "text-[var(--text)]"
          }`}
        >
          {props.valueText}
        </span>
      </div>
      {props.pct != null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-alt)]">
          <div
            className={`h-full rounded-full ${props.over ? "bg-[var(--danger)]" : "bg-[var(--accent)]"}`}
            style={{ width: `${Math.min(100, Math.max(0, props.pct))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Sheet(props: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-black/40"
        onClick={props.onClose}
      />
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[var(--surface)] px-5 pt-5 pb-safe shadow-xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">{props.title}</h2>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="关闭弹窗"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-alt)] text-lg text-[var(--dim)]"
          >
            ×
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

// Horizontal card carousel: the finger drag follows 1:1, on release it
// animates and snaps to the nearest card; the active card is full-scale
// and bright, neighbours shrink and dim slightly. Used for the home hero
// cards and the theme-card list in settings.
function SwipeCarousel(props: { ariaLabel: string; children: ReactNode[] }) {
  const slides = props.children;
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState<{ dx: number; w: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; index: number; w: number } | null>(null);
  const movedRef = useRef(false);
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      if (Math.abs(dx) > 6) movedRef.current = true;
      setDrag({ dx, w: s.w });
    };
    const up = (e: PointerEvent) => {
      const s = startRef.current;
      setDragging(false);
      setDrag(null);
      if (!s) return;
      const dx = e.clientX - s.x;
      const threshold = Math.min(64, s.w * 0.18);
      if (dx <= -threshold) setIndex(Math.min(count - 1, s.index + 1));
      else if (dx >= threshold) setIndex(Math.max(0, s.index - 1));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, count]);

  const pos = drag ? index - drag.dx / Math.max(1, drag.w) : index;
  const anim = drag || reduceMotion ? "none" : "transform 380ms cubic-bezier(0.22, 0.9, 0.28, 1), opacity 380ms, filter 380ms";

  return (
    <div>
      <div
        ref={wrapRef}
        role="group"
        aria-label={props.ariaLabel}
        className="overflow-hidden"
        style={{ touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if (count < 2) return;
          startRef.current = {
            x: e.clientX,
            index,
            w: wrapRef.current?.clientWidth ?? 1,
          };
          movedRef.current = false;
          setDragging(true);
        }}
        onClickCapture={(e) => {
          if (movedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            movedRef.current = false;
          }
        }}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(calc(${-index * 100}% + ${drag?.dx ?? 0}px))`,
            transition: drag || reduceMotion ? "none" : "transform 380ms cubic-bezier(0.22, 0.9, 0.28, 1)",
          }}
        >
          {slides.map((s, i) => {
            const dist = Math.min(1, Math.abs(pos - i));
            return (
              <div
                key={i}
                className="w-full shrink-0"
                style={{
                  transform: `scale(${1 - dist * 0.05})`,
                  opacity: 1 - dist * 0.3,
                  filter: `brightness(${1 - dist * 0.25})`,
                  transition: anim,
                }}
                aria-hidden={i !== index}
              >
                {s}
              </div>
            );
          })}
        </div>
      </div>
      {count > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`切换到第${i + 1}张卡片`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-[var(--accent)]" : "w-1.5 bg-[var(--border)]"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Calorie ring split by macro energy share (protein/carbs 4 kcal/g, fat
// 9 kcal/g). Center shows today's total; the legend lists each macro in
// grams with its share. Meals logged before macro tracking have no macro
// grams — then the ring falls back to plain progress toward the target.
function CalorieRing(props: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  target: number | null;
}) {
  const pK = props.protein * 4;
  const cK = props.carbs * 4;
  const fK = props.fat * 9;
  const total = pK + cK + fK;
  const R = 52;
  const C = 2 * Math.PI * R;
  const macros = [
    { key: "carbs", label: "碳水", grams: props.carbs, kcal: cK, color: "var(--gold)" },
    { key: "protein", label: "蛋白质", grams: props.protein, kcal: pK, color: "var(--accent)" },
    { key: "fat", label: "脂肪", grams: props.fat, kcal: fK, color: "#8fa3bf" },
  ];
  const segs: { key: string; color: string; len: number; offset: number }[] = [];
  if (total > 0) {
    let acc = 0;
    for (const m of macros) {
      if (m.kcal <= 0) continue;
      const len = (m.kcal / total) * C;
      segs.push({ key: m.key, color: m.color, len, offset: acc });
      acc += len;
    }
  }
  const gap = segs.length > 1 ? 5 : 0;
  const progress =
    total <= 0 && props.target != null && props.target > 0
      ? Math.min(1, props.calories / props.target)
      : 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[124px] w-[124px] shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label="今日热量圆环，按碳水、蛋白质、脂肪的热量占比分段">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-alt)" strokeWidth="11" />
          {segs.map((s) => (
            <circle
              key={s.key}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="11"
              strokeDasharray={`${Math.max(0, s.len - gap)} ${C - s.len + gap}`}
              strokeDashoffset={-s.offset}
            />
          ))}
          {total <= 0 && progress > 0 && (
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="11"
              strokeDasharray={`${progress * C} ${C}`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-black tabular-nums leading-none text-[var(--text)]">
            {Math.round(props.calories)}
          </span>
          <span className="mt-1 text-[11px] text-[var(--dim)]">
            大卡{props.target != null ? ` / 目标 ${props.target}` : ""}
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {macros.map((m) => (
          <li key={m.key} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-[var(--dim)]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
              {m.label}
            </span>
            <span className="tabular-nums text-[var(--text)]">
              <b className="font-display text-base">{round1(m.grams)}</b> 克
              {total > 0 && (
                <span className="ml-1.5 text-xs text-[var(--dim)]">
                  {Math.round((m.kcal / total) * 100)}%
                </span>
              )}
            </span>
          </li>
        ))}
        {total <= 0 && props.calories > 0 && (
          <li className="text-xs leading-relaxed text-[var(--dim)]">
            这几餐还没记碳水和脂肪，圆环先按热量进度显示；新记的餐会自动带上三大营养素。
          </li>
        )}
      </ul>
    </div>
  );
}

type DraftItem = { name: string; portion: string; calories: string; protein: string; carbs: string; fat: string };

function MealEditor(props: { date: string; onDone: () => void; initialMode?: "photo" | "manual" }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"photo" | "manual">(props.initialMode ?? "photo");
  const [phase, setPhase] = useState<"pick" | "analyzing" | "edit">(props.initialMode === "manual" ? "edit" : "pick");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealTypeKey>(guessMealType());
  const [items, setItems] = useState<DraftItem[]>(props.initialMode === "manual" ? [{ name: "", portion: "", calories: "", protein: "", carbs: "", fat: "" }] : []);
  const [advice, setAdvice] = useState<string | null>(null);
  const [priceYuan, setPriceYuan] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    let cal = 0;
    let pro = 0;
    let carbs = 0;
    let fat = 0;
    for (const it of items) {
      cal += parseFloat(it.calories) || 0;
      pro += parseFloat(it.protein) || 0;
      carbs += parseFloat(it.carbs) || 0;
      fat += parseFloat(it.fat) || 0;
    }
    return { cal: Math.round(cal), pro: round1(pro), carbs: round1(carbs), fat: round1(fat) };
  }, [items]);

  const analyze = useMutation({
    mutationFn: (file: File) =>
      fileToJpeg(file).then(({ dataBase64, previewUrl: url }) => {
        setPreviewUrl(url);
        return api.analyzePhoto({ imageBase64: dataBase64, mimeType: "image/jpeg" });
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        setAnalyzeError(res.error ?? "识别失败，换张照片试试，或者手动记这一餐。");
        setPhase("pick");
        return;
      }
      setPhotoKey(res.photoKey);
      setAdvice(res.advice || null);
      setItems(
        res.items.map((i) => ({
          name: i.name,
          portion: i.portion,
          calories: String(Math.round(i.calories)),
          protein: String(round1(i.protein)),
          carbs: String(round1(i.carbs)),
          fat: String(round1(i.fat)),
        })),
      );
      setPhase("edit");
    },
    onError: (err) => {
      setAnalyzeError(
        err instanceof Error && err.message
          ? err.message
          : "识别没成功，检查一下网络，或者手动记这一餐。",
      );
      setPhase("pick");
    },
  });

  const addMeal = useMutation({
    mutationFn: () => {
      const clean = items
        .filter((i) => i.name.trim().length > 0)
        .map((i) => ({
          name: i.name.trim(),
          portion: i.portion.trim(),
          calories: Math.max(0, parseFloat(i.calories) || 0),
          protein: Math.max(0, parseFloat(i.protein) || 0),
          carbs: Math.max(0, parseFloat(i.carbs) || 0),
          fat: Math.max(0, parseFloat(i.fat) || 0),
        }));
      const price = parseFloat(priceYuan);
      return api.addMeal({
        date: props.date,
        mealType,
        items: clean,
        advice: mode === "photo" ? advice : null,
        photoKey: mode === "photo" ? photoKey : null,
        priceCents:
          Number.isFinite(price) && price > 0 ? Math.round(price * 100) : null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
      props.onDone();
    },
  });

  const updateItem = (idx: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const validItems = items.filter((i) => i.name.trim().length > 0);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-[var(--surface-alt)] p-1">
        {(
          [
            { key: "photo", label: "拍照识别" },
            { key: "manual", label: "手动记" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setMode(t.key);
              if (t.key === "manual" && phase === "pick") {
                setItems([{ name: "", portion: "", calories: "", protein: "", carbs: "", fat: "" }]);
                setPhase("edit");
              }
              if (t.key === "photo" && items.length === 0) setPhase("pick");
            }}
            aria-pressed={mode === t.key}
            className={`rounded-full py-2 text-sm font-medium ${
              mode === t.key
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--dim)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "photo" && phase !== "edit" && (
        <div>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="待识别的饭菜照片"
              className="mb-3 max-h-56 w-full rounded-2xl object-cover"
            />
          )}
          {phase === "analyzing" ? (
            <p className="py-6 text-center text-sm text-[var(--dim)]">
              正在识别这餐的菜和热量…
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="rounded-2xl bg-[var(--accent)] py-4 text-base font-semibold text-white"
              >
                拍照
              </button>
              <button
                type="button"
                onClick={() => albumRef.current?.click()}
                className="rounded-2xl bg-[var(--accent-soft)] py-4 text-base font-semibold text-[var(--accent)]"
              >
                从相册选
              </button>
            </div>
          )}
          {analyzeError && (
            <p className="mt-3 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
              {analyzeError}
            </p>
          )}
          <input
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            className="hidden"
            aria-label="拍照记录这一餐"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) {
                setAnalyzeError(null);
                setPhase("analyzing");
                analyze.mutate(f);
              }
            }}
          />
          <input
            ref={albumRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            aria-label="从相册选择饭菜照片"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) {
                setAnalyzeError(null);
                setPhase("analyzing");
                analyze.mutate(f);
              }
            }}
          />
        </div>
      )}

      {phase === "edit" && (
        <div>
          {mode === "photo" && previewUrl && (
            <img
              src={previewUrl}
              alt="这一餐的照片"
              className="mb-3 max-h-44 w-full rounded-2xl object-cover"
            />
          )}
          {mode === "photo" && advice && (
            <p className="mb-3 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm leading-relaxed text-[var(--text)]">
              {advice}
            </p>
          )}

          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="餐次">
            {MEAL_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setMealType(t.key)}
                aria-pressed={mealType === t.key}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  mealType === t.key
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-alt)] text-[var(--dim)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {mode === "manual" && (
            <div className="mb-3 space-y-3">
              <p className="text-xs text-[var(--dim)]">常见食物 · 点一下就加上（通用标准估算，份量不同可再改）</p>
              {QUICK_CATS.map((cat) => (
                <div key={cat}>
                  <p className="mb-1.5 text-xs font-medium text-[var(--accent)]">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_FOODS.filter((f) => f.cat === cat).map((f) => (
                      <button
                        key={f.name}
                        type="button"
                        onClick={() =>
                          setItems((prev) => [
                            ...prev.filter((i) => i.name.trim() !== ""),
                            {
                              name: f.name,
                              portion: f.portion,
                              calories: String(f.calories),
                              protein: String(f.protein),
                              carbs: String(f.carbs),
                              fat: String(f.fat),
                            },
                          ])
                        }
                        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)]"
                      >
                        {f.name} · {f.calories}大卡
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs leading-relaxed text-[var(--dim)]">上面是常见份量的通用估算，烹调方式和实际份量不同就直接改数字。</p>
            </div>
          )}

          <div className="space-y-2">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={it.name}
                    onChange={(e) => updateItem(idx, { name: e.target.value })}
                    placeholder="食物名"
                    aria-label={`第${idx + 1}样食物名称`}
                    className="min-w-0 flex-1 bg-transparent text-base font-medium text-[var(--text)] outline-none placeholder:text-[var(--dim)]"
                  />
                  <button
                    type="button"
                    aria-label={`删除${it.name || "这一样食物"}`}
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-alt)] text-[var(--dim)]"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    value={it.portion}
                    onChange={(e) => updateItem(idx, { portion: e.target.value })}
                    placeholder="份量"
                    aria-label={`${it.name || "食物"}的份量`}
                    className="min-w-0 flex-1 rounded-lg bg-[var(--surface-alt)] px-2 py-1.5 text-[var(--text)] outline-none placeholder:text-[var(--dim)]"
                  />
                  <label className="flex items-center gap-1 text-[var(--dim)]">
                    <input
                      value={it.calories}
                      onChange={(e) => updateItem(idx, { calories: e.target.value })}
                      inputMode="numeric"
                      aria-label={`${it.name || "食物"}的热量（大卡）`}
                      className="w-16 rounded-lg bg-[var(--surface-alt)] px-2 py-1.5 text-right tabular-nums text-[var(--text)] outline-none"
                    />
                    大卡
                  </label>
                  <label className="flex items-center gap-1 text-[var(--dim)]">
                    <input
                      value={it.protein}
                      onChange={(e) => updateItem(idx, { protein: e.target.value })}
                      inputMode="decimal"
                      aria-label={`${it.name || "食物"}的蛋白质（克）`}
                      className="w-14 rounded-lg bg-[var(--surface-alt)] px-2 py-1.5 text-right tabular-nums text-[var(--text)] outline-none"
                    />
                    克
                  </label>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="flex-1 text-xs text-[var(--dim)]">碳水 / 脂肪（克，选填）</span>
                  <label className="flex items-center gap-1 text-[var(--dim)]">
                    碳水
                    <input
                      value={it.carbs}
                      onChange={(e) => updateItem(idx, { carbs: e.target.value })}
                      inputMode="decimal"
                      aria-label={`${it.name || "食物"}的碳水（克）`}
                      className="w-14 rounded-lg bg-[var(--surface-alt)] px-2 py-1.5 text-right tabular-nums text-[var(--text)] outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[var(--dim)]">
                    脂肪
                    <input
                      value={it.fat}
                      onChange={(e) => updateItem(idx, { fat: e.target.value })}
                      inputMode="decimal"
                      aria-label={`${it.name || "食物"}的脂肪（克）`}
                      className="w-14 rounded-lg bg-[var(--surface-alt)] px-2 py-1.5 text-right tabular-nums text-[var(--text)] outline-none"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setItems((prev) => [...prev, { name: "", portion: "", calories: "", protein: "", carbs: "", fat: "" }])
            }
            className="mt-2 w-full rounded-2xl border border-dashed border-[var(--border)] py-2.5 text-sm text-[var(--dim)]"
          >
            ＋ 再加一样
          </button>

          <label className="mt-4 flex items-center justify-between gap-3 text-sm text-[var(--dim)]">
            这餐花了多少钱（选填，计入今日花费）
            <span className="flex items-center gap-1">
              ¥
              <input
                value={priceYuan}
                onChange={(e) => setPriceYuan(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                aria-label="这餐的价格（元）"
                className="w-20 rounded-lg bg-[var(--surface-alt)] px-2 py-1.5 text-right tabular-nums text-[var(--text)] outline-none"
              />
            </span>
          </label>

          <button
            type="button"
            disabled={validItems.length === 0 || addMeal.isPending}
            onClick={() => addMeal.mutate()}
            className="mt-4 w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-semibold text-white disabled:opacity-40"
          >
            {addMeal.isPending
              ? "保存中…"
              : `记下这一餐 · ${totals.cal} 大卡 / 蛋白 ${totals.pro} 克 / 碳水 ${totals.carbs} 克 / 脂肪 ${totals.fat} 克`}
          </button>
          {addMeal.isError && (
            <p className="mt-2 text-center text-sm text-[var(--danger)]">
              保存失败，再试一次。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Takeout ordering assistant --------------------------------------
// Not a fixed recipe list: it reads today's live numbers (calories left,
// protein gap, budget left — all derived from the user's own targets) and
// (a) builds combos from the dish pool that fit what is left, and
// (b) judges a dish the user names, offering a lighter same-category swap
// when it would blow the day. Dish numbers are common-takeout estimates,
// labeled as such in the UI; every verdict is computed from the user's
// own day, never from a one-size-fits-all menu.
type TakeoutDish = { name: string; kcal: number; protein: number; price: number; cat: string; main: boolean };
const TAKEOUT_DISHES: TakeoutDish[] = [
  { name: "鸡腿饭（鸡腿＋米饭）", kcal: 550, protein: 32, price: 18, cat: "盖饭", main: true },
  { name: "沙县鸡腿饭", kcal: 600, protein: 30, price: 15, cat: "盖饭", main: true },
  { name: "黄焖鸡米饭", kcal: 800, protein: 35, price: 22, cat: "盖饭", main: true },
  { name: "卤肉饭", kcal: 750, protein: 22, price: 20, cat: "盖饭", main: true },
  { name: "鱼香肉丝盖饭", kcal: 780, protein: 24, price: 19, cat: "盖饭", main: true },
  { name: "扬州炒饭", kcal: 850, protein: 18, price: 20, cat: "盖饭", main: true },
  { name: "猪肉白菜水饺（12只）", kcal: 520, protein: 18, price: 18, cat: "盖饭", main: true },
  { name: "牛肉拉面", kcal: 550, protein: 20, price: 16, cat: "粉面", main: true },
  { name: "螺蛳粉", kcal: 650, protein: 15, price: 18, cat: "粉面", main: true },
  { name: "清汤米线", kcal: 480, protein: 16, price: 17, cat: "粉面", main: true },
  { name: "麻辣烫（荤素搭配一碗）", kcal: 650, protein: 25, price: 25, cat: "汤煮", main: true },
  { name: "小碗馄饨", kcal: 400, protein: 14, price: 15, cat: "汤煮", main: true },
  { name: "鸡胸肉沙拉", kcal: 350, protein: 35, price: 28, cat: "轻食", main: true },
  { name: "轻食鸡腿排套餐", kcal: 480, protein: 38, price: 32, cat: "轻食", main: true },
  { name: "全麦鸡蛋三明治", kcal: 320, protein: 14, price: 15, cat: "轻食", main: true },
  { name: "牛肉汉堡", kcal: 550, protein: 25, price: 25, cat: "快餐", main: true },
  { name: "加一份煎鸡胸", kcal: 200, protein: 31, price: 12, cat: "加料", main: false },
  { name: "白煮蛋（2个）", kcal: 140, protein: 13, price: 6, cat: "加料", main: false },
  { name: "无糖豆浆", kcal: 90, protein: 4, price: 5, cat: "加料", main: false },
  { name: "纯牛奶（250ml）", kcal: 160, protein: 8, price: 6, cat: "加料", main: false },
  { name: "炸鸡腿", kcal: 320, protein: 18, price: 13, cat: "快餐", main: false },
  { name: "中份薯条", kcal: 300, protein: 4, price: 14, cat: "快餐", main: false },
];

type Combo = { items: TakeoutDish[]; kcal: number; protein: number; price: number };

function TakeoutAssistant(props: { goSettings: () => void }) {
  const today = todayKey();
  const day = useQuery({ queryKey: ["day", today], queryFn: () => api.getDay({ date: today }) });
  const data = day.data;
  const settings = data?.settings;
  const hasTargets = settings?.calorieTarget != null && settings?.proteinTarget != null;

  const remainingKcal = hasTargets && data ? settings.calorieTarget! - data.totalCalories : 0;
  const proteinGap = hasTargets && data ? Math.max(0, settings.proteinTarget! - data.totalProtein) : 0;
  const budgetLeftCents =
    settings?.spendBudgetCents != null && data ? settings.spendBudgetCents - data.totalSpendCents : null;

  const combos = useMemo<Combo[]>(() => {
    if (!data || !hasTargets || remainingKcal <= 0) return [];
    const mains = TAKEOUT_DISHES.filter((d) => d.main);
    const sides = TAKEOUT_DISHES.filter((d) => !d.main);
    const all: Combo[] = [];
    for (const m of mains) {
      all.push({ items: [m], kcal: m.kcal, protein: m.protein, price: m.price });
      for (const s of sides) {
        all.push({ items: [m, s], kcal: m.kcal + s.kcal, protein: m.protein + s.protein, price: m.price + s.price });
      }
    }
    const fits = all.filter(
      (c) => c.kcal <= remainingKcal && (budgetLeftCents == null || c.price * 100 <= budgetLeftCents),
    );
    const score = (c: Combo) =>
      -Math.abs(c.protein - Math.max(proteinGap, 15)) - Math.abs(c.kcal - remainingKcal * 0.85) / 12;
    fits.sort((a, b) => score(b) - score(a));
    const seen = new Set<string>();
    const out: Combo[] = [];
    for (const c of fits) {
      const key = c.items[0]!.name;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
      if (out.length >= 3) break;
    }
    return out;
  }, [data, hasTargets, remainingKcal, proteinGap, budgetLeftCents]);

  // "I want to eat X" check.
  const [query, setQuery] = useState("");
  const [manualKcal, setManualKcal] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const matched = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return null;
    return (
      TAKEOUT_DISHES.find((d) => d.name.includes(q)) ??
      TAKEOUT_DISHES.find((d) => q.includes(d.name)) ??
      null
    );
  }, [query]);
  const customDish: TakeoutDish | null = matched
    ? matched
    : query.trim().length >= 2 && (parseFloat(manualKcal) || 0) > 0
      ? {
          name: query.trim(),
          kcal: parseFloat(manualKcal) || 0,
          protein: parseFloat(manualProtein) || 0,
          price: parseFloat(manualPrice) || 0,
          cat: "自定义",
          main: true,
        }
      : null;

  const verdict = useMemo(() => {
    if (!customDish || !data || !hasTargets) return null;
    const afterKcal = data.totalCalories + customDish.kcal;
    const overKcal = afterKcal - settings.calorieTarget!;
    const overBudget =
      budgetLeftCents != null && customDish.price * 100 > budgetLeftCents;
    const fitsDay = overKcal <= 0 && !overBudget;
    let alternative: TakeoutDish | null = null;
    if (!fitsDay) {
      const pool = TAKEOUT_DISHES.filter(
        (d) => d.main && d.name !== customDish.name && d.kcal < customDish.kcal,
      ).sort((a, b) => b.protein - a.protein || a.kcal - b.kcal);
      alternative =
        pool.find((d) => d.cat === customDish.cat) ?? pool[0] ?? null;
    }
    return {
      dish: customDish,
      afterKcal,
      overKcal,
      overBudget,
      fitsDay,
      proteinAfter: data.totalProtein + customDish.protein,
      alternative,
    };
  }, [customDish, data, hasTargets, settings, budgetLeftCents]);

  return (
    <div>
      {day.isPending && <p className="py-8 text-center text-sm text-[var(--dim)]">正在按你今天的状态算…</p>}
      {day.isError && <p className="py-8 text-center text-sm text-[var(--danger)]">今天的数据没加载出来，关掉重开试试。</p>}
      {data && !hasTargets && (
        <div className="py-2 text-center">
          <p className="text-sm leading-relaxed text-[var(--dim)]">
            点餐助手要按你的目标来算：先算出你每天能吃多少热量、要多少蛋白，再定个花费定额，它才能告诉你今天还能点什么、会不会超。
          </p>
          <button type="button" onClick={props.goSettings} className="mt-4 w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-semibold text-white">
            去快速计算我的目标
          </button>
        </div>
      )}
      {data && hasTargets && (
        <div>
          <section className="rounded-2xl bg-[var(--surface-alt)] px-4 py-3">
            <p className="text-xs text-[var(--dim)]">按你今天的状态（{settings.goal === "muscle" ? "增肌" : settings.goal === "shape" ? "塑形" : settings.goal === "strength" ? "力量" : "减脂"}目标）</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text)]">
              <span>还剩 <b className="font-display tabular-nums">{Math.round(remainingKcal)}</b> 大卡</span>
              <span>还差蛋白 <b className="font-display tabular-nums">{round1(proteinGap)}</b> 克</span>
              <span>
                {budgetLeftCents != null ? (
                  <>预算还剩 <b className="font-display tabular-nums">{fmtMoney(Math.max(0, budgetLeftCents))}</b></>
                ) : (
                  "没设花费定额，只按热量和蛋白算"
                )}
              </span>
            </div>
          </section>

          <h3 className="mt-5 mb-2 text-base font-semibold text-[var(--text)]">现在能点的搭配</h3>
          {remainingKcal <= 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-center text-sm leading-relaxed text-[var(--dim)]">
              今天热量已经吃满了（{Math.round(data.totalCalories)} / {settings.calorieTarget} 大卡）。真饿的话选最轻的：小碗馄饨约 400 大卡，或者一杯无糖豆浆垫一下，明天再正常吃。
            </p>
          ) : combos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-center text-sm leading-relaxed text-[var(--dim)]">
              剩下的{budgetLeftCents != null ? "热量或预算" : "热量"}太紧，常见外卖里没有能整份吃完又不超的搭配了。试试半份主食＋加蛋白，或者在下面输入你想吃的，我帮你算超多少。
            </p>
          ) : (
            <div className="space-y-2.5">
              {combos.map((c) => (
                <article key={c.items.map((i) => i.name).join("+")} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                  <p className="text-sm font-semibold leading-snug text-[var(--text)]">
                    {c.items.map((i) => i.name).join(" ＋ ")}
                  </p>
                  <p className="mt-1.5 text-sm tabular-nums text-[var(--dim)]">
                    约 <b className="font-display text-base text-[var(--text)]">{c.kcal}</b> 大卡 · 蛋白{" "}
                    <b className="text-[var(--text)]">{c.protein}</b> 克 · 约 ¥{c.price}
                    <span className="ml-2 text-xs">吃完还剩 {Math.round(remainingKcal - c.kcal)} 大卡</span>
                  </p>
                </article>
              ))}
            </div>
          )}

          <h3 className="mt-6 mb-2 text-base font-semibold text-[var(--text)]">想吃别的？先算再点</h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入想吃的店或菜，如：黄焖鸡、沙拉、螺蛳粉"
            aria-label="想吃的外卖（店名或菜名）"
            className="w-full rounded-2xl bg-[var(--surface-alt)] px-4 py-3 text-base text-[var(--text)] outline-none placeholder:text-[var(--dim)]"
          />
          {query.trim().length >= 2 && !matched && (
            <div className="mt-2 rounded-2xl border border-dashed border-[var(--border)] p-3">
              <p className="text-xs leading-relaxed text-[var(--dim)]">常见外卖里没收录「{query.trim()}」，把它的热量填上就能算（包装或店铺页一般有标注）：</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs text-[var(--dim)]">热量 大卡<input value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} inputMode="numeric" aria-label="这顿的热量（大卡）" className="mt-1 w-full rounded-lg bg-[var(--surface-alt)] px-2 py-2 text-sm tabular-nums text-[var(--text)] outline-none" /></label>
                <label className="text-xs text-[var(--dim)]">蛋白 克<input value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} inputMode="decimal" aria-label="这顿的蛋白质（克）" className="mt-1 w-full rounded-lg bg-[var(--surface-alt)] px-2 py-2 text-sm tabular-nums text-[var(--text)] outline-none" /></label>
                <label className="text-xs text-[var(--dim)]">价格 元<input value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} inputMode="decimal" aria-label="这顿的价格（元）" className="mt-1 w-full rounded-lg bg-[var(--surface-alt)] px-2 py-2 text-sm tabular-nums text-[var(--text)] outline-none" /></label>
              </div>
            </div>
          )}
          {verdict && (
            <div className={`mt-3 rounded-2xl p-4 ${verdict.fitsDay ? "bg-[var(--accent-soft)]" : "bg-[var(--danger-soft)]"}`}>
              <p className="text-sm font-semibold text-[var(--text)]">
                {verdict.dish.name} · 约 {verdict.dish.kcal} 大卡 · 蛋白 {verdict.dish.protein} 克 · 约 ¥{verdict.dish.price}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">
                {verdict.fitsDay ? (
                  <>可以点。吃完今天到 {Math.round(verdict.afterKcal)} / {settings.calorieTarget} 大卡，蛋白 {round1(verdict.proteinAfter)} / {settings.proteinTarget} 克{verdict.proteinAfter >= settings.proteinTarget! ? "，蛋白也达标了" : `，还差 ${round1(settings.proteinTarget! - verdict.proteinAfter)} 克蛋白`}。</>
                ) : (
                  <>
                    {verdict.overKcal > 0 && <>这顿吃完热量会超 <b className="text-[var(--danger)]">{Math.round(verdict.overKcal)} 大卡</b>（到 {Math.round(verdict.afterKcal)} / {settings.calorieTarget}）。</>}
                    {verdict.overBudget && <>价格 ¥{verdict.dish.price} 也超过了今天剩下的预算 {fmtMoney(Math.max(0, budgetLeftCents ?? 0))}。</>}
                  </>
                )}
              </p>
              {!verdict.fitsDay && verdict.alternative && (
                <div className="mt-3 rounded-xl bg-[var(--surface)] p-3">
                  <p className="text-xs text-[var(--dim)]">换这个就不超：</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">{verdict.alternative.name}</p>
                  <p className="mt-0.5 text-sm tabular-nums text-[var(--dim)]">
                    约 {verdict.alternative.kcal} 大卡 · 蛋白 {verdict.alternative.protein} 克 · 约 ¥{verdict.alternative.price} · 吃完到 {Math.round(data.totalCalories + verdict.alternative.kcal)} / {settings.calorieTarget} 大卡
                  </p>
                </div>
              )}
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-[var(--dim)]">
            菜品的热量、蛋白和价格是常见外卖的估算值，不同店铺份量差别不小，下单时以店铺标注和实际份量为准；推荐只按你自己的目标和今天的剩余额度算，不是一份固定菜谱。
          </p>
        </div>
      )}
    </div>
  );
}

function ExpenseForm(props: { date: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<CategoryKey>("food");
  const [note, setNote] = useState("");

  const addExpense = useMutation({
    mutationFn: () =>
      api.addExpense({
        date: props.date,
        amountCents: Math.round((parseFloat(amount) || 0) * 100),
        category,
        note: note.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      props.onDone();
    },
  });

  const valid = (parseFloat(amount) || 0) > 0;

  return (
    <div>
      <label className="flex items-center gap-2 rounded-2xl bg-[var(--surface-alt)] px-4 py-3">
        <span className="text-2xl text-[var(--dim)]">¥</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          aria-label="花费金额（元）"
          autoFocus
          className="w-full bg-transparent font-display text-3xl font-bold tabular-nums text-[var(--text)] outline-none placeholder:text-[var(--dim)]"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="花费分类">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            aria-pressed={category === c.key}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              category === c.key
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface-alt)] text-[var(--dim)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注，比如：食堂午饭、打车回学校"
        aria-label="花费备注"
        className="mt-4 w-full rounded-2xl bg-[var(--surface-alt)] px-4 py-3 text-base text-[var(--text)] outline-none placeholder:text-[var(--dim)]"
      />

      <button
        type="button"
        disabled={!valid || addExpense.isPending}
        onClick={() => addExpense.mutate()}
        className="mt-4 w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-semibold text-white disabled:opacity-40"
      >
        {addExpense.isPending ? "保存中…" : "记下这笔"}
      </button>
      {addExpense.isError && (
        <p className="mt-2 text-center text-sm text-[var(--danger)]">保存失败，再试一次。</p>
      )}
    </div>
  );
}

function FeedbackForm(props: { onDone?: () => void }) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const list = useQuery({
    queryKey: ["feedbacks"],
    queryFn: () => api.getFeedbacks({}),
  });

  const submit = useMutation({
    mutationFn: () =>
      api.submitFeedback({
        category,
        content: content.trim(),
        contact: contact.trim(),
      }),
    onSuccess: () => {
      setSubmitted(true);
      setContent("");
      setContact("");
      void queryClient.invalidateQueries();
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => api.deleteFeedback({ id }),
    onSuccess: () => {
      setConfirmDel(null);
      void queryClient.invalidateQueries();
    },
  });

  const valid = content.trim().length >= 2;
  const hint = FEEDBACK_CATEGORIES.find((c) => c.key === category)?.hint ?? "";
  const items = list.data?.feedbacks ?? [];

  if (submitted) {
    return (
      <div>
        <div className="rounded-3xl bg-[var(--accent-soft)] px-5 py-6 text-center">
          <p className="font-display text-xl font-black text-[var(--text)]">收到，谢谢你提！</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
            这条已经存下来了，在下面「我提过的」里能看到，也能删。再有想法随时再提一条。
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="rounded-2xl bg-[var(--surface-alt)] py-3 text-sm font-semibold text-[var(--text)]"
          >
            再提一条
          </button>
          <button
            type="button"
            onClick={() => props.onDone?.()}
            className="rounded-2xl bg-[var(--accent)] py-3 text-sm font-semibold text-white"
          >
            完成
          </button>
        </div>
        {items.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">我提过的 · {items.length} 条</h3>
            <ul className="space-y-2">
              {items.map((f) => (
                <li key={f.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                      {feedbackCategoryLabel(f.category)}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-[var(--dim)]">
                      {prettyDate(f.createdAt.slice(0, 10))} {timeOf(f.createdAt)}
                      {confirmDel === f.id ? (
                        <>
                          <button type="button" onClick={() => del.mutate(f.id)} className="font-semibold text-[var(--danger)]">确认删除</button>
                          <button type="button" onClick={() => setConfirmDel(null)} className="text-[var(--dim)]">取消</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirmDel(f.id)} aria-label={`删除这条建议：${f.content.slice(0, 20)}`} className="text-[var(--dim)]">删除</button>
                      )}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">{f.content}</p>
                  {f.contact && <p className="mt-1 text-xs text-[var(--dim)]">联系方式：{f.contact}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm leading-relaxed text-[var(--dim)]">
        有什么想改的、想要的新功能，或者哪里用着不顺手，写下来就行。提交后会存下来，你随时能在下面回看。
      </p>

      <p className="mt-4 mb-2 text-xs font-medium text-[var(--dim)]">建议类型</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="建议类型">
        {FEEDBACK_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            aria-pressed={category === c.key}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              category === c.key
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface-alt)] text-[var(--dim)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-[var(--dim)]">{hint}</p>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-[var(--dim)]">具体说说（至少写 2 个字）</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="比如：希望拍照识别完能直接改份量；或者体重页想看月平均……"
          aria-label="建议内容"
          rows={5}
          maxLength={1000}
          className="mt-1.5 w-full resize-none rounded-2xl bg-[var(--surface-alt)] px-4 py-3 text-base leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--dim)]"
        />
        <span className="mt-1 block text-right text-xs tabular-nums text-[var(--dim)]">{content.length} / 1000</span>
      </label>

      <label className="mt-2 block">
        <span className="text-xs font-medium text-[var(--dim)]">联系方式（选填，方便回复你）</span>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="微信 / 手机号 / 邮箱，不填也没关系"
          aria-label="联系方式（选填）"
          maxLength={100}
          className="mt-1.5 w-full rounded-2xl bg-[var(--surface-alt)] px-4 py-3 text-base text-[var(--text)] outline-none placeholder:text-[var(--dim)]"
        />
      </label>

      <button
        type="button"
        disabled={!valid || submit.isPending}
        onClick={() => submit.mutate()}
        className="mt-4 w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-semibold text-white disabled:opacity-40"
      >
        {submit.isPending ? "提交中…" : "提交建议"}
      </button>
      {submit.isError && (
        <p className="mt-2 text-center text-sm text-[var(--danger)]">提交失败，再试一次，内容还在上面不会丢。</p>
      )}

      <div className="mt-6">
        <h3 className="mb-2 flex items-baseline justify-between text-sm font-semibold text-[var(--text)]">
          <span>我提过的</span>
          {items.length > 0 && <span className="text-xs font-normal text-[var(--dim)]">{items.length} 条</span>}
        </h3>
        {list.isPending && <p className="py-4 text-center text-sm text-[var(--dim)]">加载中…</p>}
        {list.isError && <p className="py-4 text-center text-sm text-[var(--danger)]">之前的建议没加载出来，关掉重开试试。</p>}
        {list.data && items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-center text-sm text-[var(--dim)]">
            还没提过建议。上面写一条，提交后就会出现在这里。
          </p>
        )}
        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((f) => (
              <li key={f.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                    {feedbackCategoryLabel(f.category)}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-[var(--dim)]">
                    {prettyDate(f.createdAt.slice(0, 10))} {timeOf(f.createdAt)}
                    {confirmDel === f.id ? (
                      <>
                        <button type="button" onClick={() => del.mutate(f.id)} className="font-semibold text-[var(--danger)]">确认删除</button>
                        <button type="button" onClick={() => setConfirmDel(null)} className="text-[var(--dim)]">取消</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDel(f.id)} aria-label={`删除这条建议：${f.content.slice(0, 20)}`} className="text-[var(--dim)]">删除</button>
                    )}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">{f.content}</p>
                {f.contact && <p className="mt-1 text-xs text-[var(--dim)]">联系方式：{f.contact}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MealCard(props: { meal: Meal }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const del = useMutation({
    mutationFn: () => api.deleteMeal({ id: props.meal.id }),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  const m = props.meal;
  const title = m.items.map((i) => i.name).join("、") || "一餐";
  return (
    <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex gap-3">
        {m.photoUrl && (
          <img
            src={m.photoUrl}
            alt={`${title}的照片`}
            className="h-20 w-20 shrink-0 rounded-2xl object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-[var(--dim)]">
              {mealTypeLabel(m.mealType)} · {timeOf(m.createdAt)}
              {m.priceCents != null && <> · {fmtMoney(m.priceCents)}</>}
            </p>
            {confirming ? (
              <span className="flex shrink-0 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => del.mutate()}
                  className="font-semibold text-[var(--danger)]"
                >
                  确认删除
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-[var(--dim)]"
                >
                  取消
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label={`删除这餐：${title}`}
                className="shrink-0 text-xs text-[var(--dim)]"
              >
                删除
              </button>
            )}
          </div>
          <h3 className="mt-0.5 line-clamp-2 text-base font-semibold leading-snug text-[var(--text)]">
            {title}
          </h3>
          <p className="mt-1 text-sm tabular-nums text-[var(--text)]">
            <span className="font-display text-xl font-bold">{Math.round(m.totalCalories)}</span>{" "}
            大卡 · 蛋白 {round1(m.totalProtein)} 克
            {(m.totalCarbs > 0 || m.totalFat > 0) && (
              <> · 碳水 {round1(m.totalCarbs)} 克 · 脂肪 {round1(m.totalFat)} 克</>
            )}
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-3">
        {m.items.map((it, i) => (
          <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-[var(--text)]">
              {it.name}
              {it.portion && <span className="text-[var(--dim)]"> · {it.portion}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--dim)]">
              {Math.round(it.calories)} 大卡 · 蛋白 {round1(it.protein)} 克
              {(it.carbs > 0 || it.fat > 0) && (
                <> · 碳水 {round1(it.carbs)} · 脂肪 {round1(it.fat)}</>
              )}
            </span>
          </li>
        ))}
      </ul>
      {m.advice && (
        <p className="mt-3 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm leading-relaxed text-[var(--text)]">
          {m.advice}
        </p>
      )}
    </article>
  );
}

function TodayView(props: {
  date: string;
  setDate: (d: string) => void;
  openMeal: () => void;
  openExpense: () => void;
  openTakeout: () => void;
  goSettings: () => void;
}) {
  const queryClient = useQueryClient();
  const day = useQuery({
    queryKey: ["day", props.date],
    queryFn: () => api.getDay({ date: props.date }),
  });
  const plan = useQuery({
    queryKey: ["workoutPlan"],
    queryFn: () => api.getWorkoutPlan({}),
  });
  const [confirmingExpense, setConfirmingExpense] = useState<number | null>(null);
  const delExpense = useMutation({
    mutationFn: (id: number) => api.deleteExpense({ id }),
    onSuccess: () => void queryClient.invalidateQueries(),
  });

  const isToday = props.date === todayKey();
  const data = day.data;
  const settings = data?.settings;
  const calorieTarget = settings?.calorieTarget ?? null;
  const hasTargets = calorieTarget != null && settings?.proteinTarget != null;
  const remaining = calorieTarget != null ? calorieTarget - (data?.totalCalories ?? 0) : 0;
  const over = calorieTarget != null && remaining < 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="前一天"
          onClick={() => props.setDate(shiftKey(props.date, -1))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)] text-lg text-[var(--dim)] shadow-sm"
        >
          ‹
        </button>
        <p className="text-base font-medium text-[var(--text)]">
          {dayLabel(props.date)}
          {!isToday && <span className="text-[var(--dim)]"> · {prettyDate(props.date)}</span>}
        </p>
        <button
          type="button"
          aria-label="后一天"
          disabled={isToday}
          onClick={() => props.setDate(shiftKey(props.date, 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)] text-lg text-[var(--dim)] shadow-sm disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {day.isPending && <p className="py-16 text-center text-sm text-[var(--dim)]">加载中…</p>}
      {day.isError && (
        <div className="py-16 text-center">
          <p className="text-sm text-[var(--danger)]">这一天的记录没加载出来。</p>
          <button
            type="button"
            onClick={() => void day.refetch()}
            className="mt-3 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white"
          >
            重试
          </button>
        </div>
      )}

      {data && settings && (
        <>
          {!hasTargets ? (
          <section className="mt-5 rounded-3xl bg-[var(--surface)] p-5 text-center shadow-sm">
            <p className="font-display text-xl font-black text-[var(--text)]">先算出你每天能吃多少</p>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[var(--dim)]">填身高、体重、年龄、性别和活动量算出热量和蛋白质目标，再定每天花费定额，这里就按算出来的数显示。</p>
            <p className="mt-3 text-sm tabular-nums text-[var(--dim)]">这天已吃 {Math.round(data.totalCalories)} 大卡 · 蛋白 {round1(data.totalProtein)} 克 · 花 {fmtMoney(data.totalSpendCents)}</p>
            <button type="button" onClick={props.goSettings} className="mt-4 w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-semibold text-white">去快速计算我的目标</button>
          </section>
          ) : (
          <section className="mt-5 rounded-3xl bg-[var(--surface)] p-5 shadow-sm">
            <p className="text-sm text-[var(--dim)]">{over ? "今天热量已超出" : "今天还能吃"}</p>
            <p
              className={`mt-1 font-display text-6xl font-black tabular-nums leading-none ${
                over ? "text-[var(--danger)]" : "text-[var(--accent)]"
              }`}
            >
              {Math.abs(Math.round(remaining))}
              <span className="ml-2 align-middle font-sans text-base font-normal text-[var(--dim)]">
                大卡
              </span>
            </p>
            <div className="mt-5 space-y-4">
              <ProgressRule
                label="热量"
                valueText={`${Math.round(data.totalCalories)} / ${settings.calorieTarget ?? "—"} 大卡`}
                pct={settings.calorieTarget ? (data.totalCalories / settings.calorieTarget) * 100 : null}
                over={over}
              />
              <ProgressRule
                label="蛋白质"
                valueText={`${round1(data.totalProtein)} / ${settings.proteinTarget ?? "—"} 克`}
                pct={settings.proteinTarget ? (data.totalProtein / Math.max(1, settings.proteinTarget)) * 100 : null}
                over={settings.proteinTarget != null && data.totalProtein > settings.proteinTarget * 1.5}
              />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[var(--dim)]">碳水 · 脂肪</span>
                <span className="text-sm tabular-nums text-[var(--text)]">
                  {round1(data.totalCarbs)} 克 · {round1(data.totalFat)} 克
                </span>
              </div>
              {settings.spendBudgetCents != null ? (
                <ProgressRule
                  label="今日花费"
                  valueText={`${fmtMoney(data.totalSpendCents)} / ${fmtMoney(settings.spendBudgetCents)}`}
                  pct={(data.totalSpendCents / Math.max(1, settings.spendBudgetCents)) * 100}
                  over={data.totalSpendCents > settings.spendBudgetCents}
                />
              ) : (
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-[var(--dim)]">今日花费</span>
                  <button
                    type="button"
                    onClick={props.goSettings}
                    className="text-sm font-medium tabular-nums text-[var(--text)] underline decoration-[var(--gold)] decoration-2 underline-offset-4"
                  >
                    {fmtMoney(data.totalSpendCents)} · 去设每日目标
                  </button>
                </div>
              )}
            </div>
          </section>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={props.openMeal}
              className="rounded-3xl bg-[var(--accent)] py-4 text-base font-semibold text-white shadow-sm"
            >
              记一餐
            </button>
            <button
              type="button"
              onClick={props.openExpense}
              className="rounded-3xl bg-[var(--surface)] py-4 text-base font-semibold text-[var(--accent)] shadow-sm"
            >
              记一笔花费
            </button>
          </div>

          <p className="mt-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2 text-center text-sm text-[var(--text)]">
            {plan.data == null
              ? "训练计划在「健身」页自己组，「体重」记晨起空腹体重"
              : plan.data.days.length === 0
                ? "还没建训练计划 · 去「目标」页生成你的三分化，或去「健身」页自己选动作组一个"
                : `我的训练计划：${plan.data.days.map((d) => d.name).join("、")} · 去「健身」打卡`}
          </p>

          <div className="mt-7 mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[var(--text)]">饮食</h2>
            {isToday && (
              <button
                type="button"
                onClick={props.openTakeout}
                className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white"
              >
                外卖点餐助手
              </button>
            )}
          </div>
          {data.meals.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--dim)]">
              {isToday ? "今天" : "这天"}还没记吃的。点「记一餐」，拍张照就能算热量。
            </p>
          ) : (
            <div className="space-y-3">
              {data.meals.map((m) => (
                <MealCard key={m.id} meal={m} />
              ))}
            </div>
          )}

          <h2 className="mt-7 mb-3 font-display text-lg font-bold text-[var(--text)]">花费</h2>
          {data.expenses.length === 0 &&
          !data.meals.some((m) => m.priceCents != null) ? (
            <p className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--dim)]">
              {isToday ? "今天" : "这天"}还没记花费。
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-4">
              {data.meals
                .filter((m) => m.priceCents != null)
                .map((m) => (
                  <li key={`meal-${m.id}`} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--text)]">
                        <span className="mr-2 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent)]">
                          餐饮
                        </span>
                        {mealTypeLabel(m.mealType)} · {m.items.map((i) => i.name).join("、")}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--dim)]">{timeOf(m.createdAt)}</p>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums text-[var(--text)]">
                      {fmtMoney(m.priceCents ?? 0)}
                    </span>
                  </li>
                ))}
              {data.expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--text)]">
                      <span className="mr-2 rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-xs text-[var(--dim)]">
                        {categoryLabel(e.category)}
                      </span>
                      {e.note || categoryLabel(e.category)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--dim)]">{timeOf(e.createdAt)}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-medium tabular-nums text-[var(--text)]">
                      {fmtMoney(e.amountCents)}
                    </span>
                    {confirmingExpense === e.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => delExpense.mutate(e.id)}
                          className="text-xs font-semibold text-[var(--danger)]"
                        >
                          确认删除
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingExpense(null)}
                          className="text-xs text-[var(--dim)]"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingExpense(e.id)}
                        aria-label={`删除这笔花费：${e.note || categoryLabel(e.category)}`}
                        className="text-xs text-[var(--dim)]"
                      >
                        删除
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function HistoryView(props: { openDay: (date: string) => void }) {
  const to = todayKey();
  const from = shiftKey(to, -59);
  const history = useQuery({
    queryKey: ["history", from, to],
    queryFn: () => api.getHistory({ from, to }),
  });
  const data: HistoryData | undefined = history.data;
  return (
    <div>
      <h2 className="font-display text-xl font-bold text-[var(--text)]">近 60 天</h2>
      {history.isPending && <p className="py-16 text-center text-sm text-[var(--dim)]">加载中…</p>}
      {history.isError && (
        <div className="py-16 text-center">
          <p className="text-sm text-[var(--danger)]">历史记录没加载出来。</p>
          <button
            type="button"
            onClick={() => void history.refetch()}
            className="mt-3 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white"
          >
            重试
          </button>
        </div>
      )}
      {data && data.days.length === 0 && (
        <p className="mt-6 rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--dim)]">
          还没有任何记录。从今天的第一餐开始记吧。
        </p>
      )}
      {data && data.days.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--border)] rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-4">
          {data.days.map((d) => {
            const overCal = data.settings.calorieTarget != null && d.totalCalories > data.settings.calorieTarget;
            const overSpend =
              data.settings.spendBudgetCents != null &&
              d.totalSpendCents > data.settings.spendBudgetCents;
            return (
              <li key={d.date}>
                <button
                  type="button"
                  onClick={() => props.openDay(d.date)}
                  aria-label={`查看${dayLabel(d.date)}的记录`}
                  className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">{dayLabel(d.date)}</p>
                    <p className="mt-0.5 text-xs text-[var(--dim)]">
                      {d.mealCount} 餐 · 蛋白 {round1(d.totalProtein)} 克
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        overCal ? "text-[var(--danger)]" : "text-[var(--text)]"
                      }`}
                    >
                      {Math.round(d.totalCalories)} 大卡
                    </p>
                    <p
                      className={`mt-0.5 text-xs tabular-nums ${
                        overSpend ? "text-[var(--danger)]" : "text-[var(--dim)]"
                      }`}
                    >
                      花 {fmtMoney(d.totalSpendCents)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TrendChart(props: { title: string; unit: string; data: { label: string; value: number | null }[]; target?: number; color?: string }) {
  const chartData = props.data.map((d) => ({ name: d.label, value: d.value }));
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">{props.title}</h3>
        <span className="text-xs text-[var(--dim)]">{props.unit}</span>
      </div>
      <div className="mt-2 h-44 w-full" role="img" aria-label={`${props.title}趋势图`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--dim)" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: "var(--dim)" }} domain={[0, "auto"]} />
            <Tooltip formatter={(v: unknown) => [`${String(v ?? "—")} ${props.unit}`, props.title]} labelFormatter={(l: unknown) => String(l)} />
            {props.target != null && <ReferenceLine y={props.target} stroke="var(--gold)" strokeDasharray="4 4" label={{ value: `目标 ${props.target}`, fontSize: 10, fill: "var(--gold)", position: "insideTopRight" }} />}
            <Line type="monotone" dataKey="value" stroke={props.color ?? "var(--accent)"} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function mondayOf(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return toKey(d);
}

function TrendsView(props: { openDay: (date: string) => void }) {
  const to = todayKey();
  const from = shiftKey(to, -27);
  const history = useQuery({ queryKey: ["history28", from, to], queryFn: () => api.getHistory({ from, to }) });
  const data = history.data;
  const byDate = useMemo(() => {
    const m = new Map<string, { totalCalories: number; totalProtein: number; totalSpendCents: number; mealCount: number }>();
    for (const d of data?.days ?? []) m.set(d.date, d);
    return m;
  }, [data]);
  const daily = useMemo(() => {
    const arr: { date: string; label: string; cal: number | null; pro: number | null; spend: number | null }[] = [];
    for (let i = 27; i >= 0; i--) {
      const date = shiftKey(to, -i);
      const row = byDate.get(date);
      const d = new Date(`${date}T00:00:00`);
      arr.push({
        date,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        cal: row ? Math.round(row.totalCalories) : null,
        pro: row ? round1(row.totalProtein) : null,
        spend: row ? Math.round(row.totalSpendCents / 100 * 10) / 10 : null,
      });
    }
    return arr;
  }, [byDate, to]);
  const weeks = useMemo(() => {
    const map = new Map<string, { days: number; cal: number; pro: number; spend: number }>();
    for (const d of daily) {
      if (d.cal == null) continue;
      const mon = mondayOf(d.date);
      const cur = map.get(mon) ?? { days: 0, cal: 0, pro: 0, spend: 0 };
      cur.days += 1; cur.cal += d.cal ?? 0; cur.pro += d.pro ?? 0; cur.spend += d.spend ?? 0;
      map.set(mon, cur);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 4).map(([mon, v]) => ({
      mon, label: `${prettyDate(mon)}当周`,
      avgCal: Math.round(v.cal / Math.max(1, v.days)),
      avgPro: round1(v.pro / Math.max(1, v.days)),
      totalSpend: Math.round(v.spend),
      days: v.days,
    }));
  }, [daily]);
  const last7 = daily.slice(-7);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--text)]">每周图表</h2>
        <p className="mt-1 text-sm text-[var(--dim)]">近4周趋势 · 没记的日子图上是断点，不算0。{data && data.settings.proteinTarget != null ? `蛋白目标 ${data.settings.proteinTarget} 克${data.settings.proteinMin != null ? `（建议 ${data.settings.proteinMin}–${data.settings.proteinMax} 克）` : ""}。` : "蛋白目标还没算，去「目标」页用快速计算。"}</p>
      </div>
      {history.isPending && <p className="py-10 text-center text-sm text-[var(--dim)]">加载中…</p>}
      {history.isError && <p className="py-10 text-center text-sm text-[var(--danger)]">图表没加载出来，点底部「图表」再试。</p>}
      {data && (
        <>
          <TrendChart title="热量 · 近7天" unit="大卡" data={last7.map((d) => ({ label: d.label, value: d.cal }))} target={data.settings.calorieTarget ?? undefined} />
          <TrendChart title="蛋白质 · 近7天" unit="克" data={last7.map((d) => ({ label: d.label, value: d.pro }))} target={data.settings.proteinTarget ?? undefined} color="#b07d2b" />
          <TrendChart title="花费 · 近7天" unit="元" data={last7.map((d) => ({ label: d.label, value: d.spend }))} target={data.settings.spendBudgetCents != null ? data.settings.spendBudgetCents / 100 : undefined} color="#2563eb" />
          <TrendChart title="热量 · 近28天" unit="大卡" data={daily.map((d) => ({ label: d.label, value: d.cal }))} target={data.settings.calorieTarget ?? undefined} />
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">周平均</h3>
            {weeks.length === 0 ? <p className="mt-2 text-sm text-[var(--dim)]">还没有记录，先去今日记一餐。</p> : (
              <ul className="mt-2 divide-y divide-[var(--border)]">
                {weeks.map((w) => (
                  <li key={w.mon} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-[var(--text)]">{w.label}<span className="ml-1 text-xs text-[var(--dim)]">记了{w.days}天</span></span>
                    <span className="tabular-nums text-[var(--dim)]">{w.avgCal}大卡 · 蛋白{w.avgPro}克 · 花¥{w.totalSpend}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <HistoryView openDay={props.openDay} />
        </>
      )}
    </div>
  );
}

function WeightView() {
  const queryClient = useQueryClient();
  const to = todayKey();
  const from = shiftKey(to, -119);
  const q = useQuery({ queryKey: ["weights", from, to], queryFn: () => api.getWeights({ from, to }) });
  const [date, setDate] = useState(todayKey());
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const save = useMutation({
    mutationFn: () => api.upsertWeight({ date, weightKg: parseFloat(weight) || 0, bodyFatPct: fat.trim() === "" ? null : parseFloat(fat) }),
    onSuccess: () => { void queryClient.invalidateQueries(); setWeight(""); setFat(""); },
  });
  const del = useMutation({ mutationFn: (id: number) => api.deleteWeight({ id }), onSuccess: () => void queryClient.invalidateQueries() });
  const entries = q.data?.entries ?? [];
  const sortedAsc = useMemo(() => [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)), [entries]);
  const weekly = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const e of entries) { const mon = mondayOf(e.date); const arr = map.get(mon) ?? []; arr.push(e.weightKg); map.set(mon, arr); }
    return [...map.entries()].map(([mon, arr]) => ({ mon, avg: round1(arr.reduce((s, v) => s + v, 0) / arr.length), count: arr.length })).sort((a, b) => (a.mon < b.mon ? 1 : -1));
  }, [entries]);
  const latest = sortedAsc[sortedAsc.length - 1];
  const thisWeekAvg = weekly[0]?.avg;
  const chartData = sortedAsc.slice(-30).map((e) => { const d = new Date(`${e.date}T00:00:00`); return { label: `${d.getMonth() + 1}/${d.getDate()}`, value: e.weightKg }; });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--text)]">体重</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">只记晨起空腹体重，只看周平均和趋势，不看单日波动。参考区间 63–66 kg，目标体脂率约 14–15%。</p>
      </div>
      <section className="rounded-3xl bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex gap-4">
          <div className="flex-1"><p className="text-xs text-[var(--dim)]">最近一次</p><p className="mt-1 font-display text-3xl font-black tabular-nums text-[var(--text)]">{latest ? `${latest.weightKg} kg` : "—"}</p>{latest && <p className="text-xs text-[var(--dim)]">{dayLabel(latest.date)}{latest.bodyFatPct != null ? ` · 体脂 ${latest.bodyFatPct}%` : ""}</p>}</div>
          <div className="flex-1"><p className="text-xs text-[var(--dim)]">本周平均</p><p className="mt-1 font-display text-3xl font-black tabular-nums text-[var(--accent)]">{thisWeekAvg != null ? `${thisWeekAvg} kg` : "—"}</p><p className="text-xs text-[var(--dim)]">区间 63–66 kg</p></div>
        </div>
      </section>
      {chartData.length >= 2 && <TrendChart title="体重趋势 · 近30条" unit="kg" data={chartData} />}
      {chartData.length > 0 && chartData.length < 2 && <p className="rounded-2xl bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--dim)]">再记一次就能画趋势线了。</p>}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">记今天体重</h3>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className="text-xs text-[var(--dim)]">日期<input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="体重日期" className="mt-1 w-full rounded-xl bg-[var(--surface-alt)] px-2 py-2 text-sm text-[var(--text)] outline-none" /></label>
          <label className="text-xs text-[var(--dim)]">体重 kg<input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="如 66.0" aria-label="体重（公斤）" className="mt-1 w-full rounded-xl bg-[var(--surface-alt)] px-2 py-2 text-sm tabular-nums text-[var(--text)] outline-none" /></label>
          <label className="text-xs text-[var(--dim)]">体脂 %（选填）<input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="decimal" placeholder="如 17" aria-label="体脂率（百分比，选填）" className="mt-1 w-full rounded-xl bg-[var(--surface-alt)] px-2 py-2 text-sm tabular-nums text-[var(--text)] outline-none" /></label>
        </div>
        <button type="button" disabled={!weight || parseFloat(weight) <= 0 || save.isPending} onClick={() => save.mutate()} className="mt-3 w-full rounded-2xl bg-[var(--accent)] py-3 text-base font-semibold text-white disabled:opacity-40">{save.isPending ? "保存中…" : "保存体重（同一天会覆盖）"}</button>
        {save.isError && <p className="mt-2 text-center text-sm text-[var(--danger)]">保存失败，再试一次。</p>}
        <p className="mt-2 text-xs text-[var(--dim)]">体脂秤单次波动大，只看趋势，别被某一次数字吓到。</p>
      </section>
      {weekly.length > 0 && (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">周平均</h3>
          <ul className="mt-2 divide-y divide-[var(--border)]">{weekly.slice(0, 8).map((w) => (<li key={w.mon} className="flex justify-between py-2 text-sm"><span className="text-[var(--text)]">{prettyDate(w.mon)}当周 · {w.count}次</span><span className="font-medium tabular-nums text-[var(--text)]">{w.avg} kg</span></li>))}</ul>
        </section>
      )}
      {entries.length > 0 && (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-4">
          <ul className="divide-y divide-[var(--border)]">{entries.slice(0, 20).map((e) => (<li key={e.id} className="flex items-center justify-between py-2.5 text-sm"><span className="text-[var(--text)]">{dayLabel(e.date)}{e.bodyFatPct != null ? <span className="ml-2 text-xs text-[var(--dim)]">体脂 {e.bodyFatPct}%</span> : null}</span><span className="flex items-center gap-2"><span className="tabular-nums font-medium text-[var(--text)]">{e.weightKg} kg</span>{confirmDel === e.id ? <><button type="button" onClick={() => del.mutate(e.id)} className="text-xs font-semibold text-[var(--danger)]">确认删除</button><button type="button" onClick={() => setConfirmDel(null)} className="text-xs text-[var(--dim)]">取消</button></> : <button type="button" onClick={() => setConfirmDel(e.id)} aria-label={`删除${e.date}的体重`} className="text-xs text-[var(--dim)]">删除</button>}</span></li>))}</ul>
        </section>
      )}
      {q.isPending && <p className="py-8 text-center text-sm text-[var(--dim)]">加载中…</p>}
    </div>
  );
}

function FitnessView() {
  const queryClient = useQueryClient();
  const today = todayKey();
  const from = shiftKey(today, -119);
  const q = useQuery({ queryKey: ["fitness", from, today], queryFn: () => api.getFitness({ from, to: today }) });
  const planQ = useQuery({ queryKey: ["workoutPlan"], queryFn: () => api.getWorkoutPlan({}) });

  // Custom plan editing. Drafts are local per training day, seeded from the
  // server row the first time it appears and after each successful save —
  // unsaved edits are never overwritten by a refetch.
  const serverDays = planQ.data?.days ?? [];
  const [drafts, setDrafts] = useState<Record<number, WorkoutDayDraft>>({});
  // syncedRef holds the last server JSON each draft was synced from. A
  // refetch only replaces a draft when that draft is untouched (not dirty),
  // so unsaved edits are never overwritten.
  const syncedRef = useRef<Record<number, string>>({});
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const d of serverDays) {
        const serverJson = JSON.stringify({ name: d.name, exercises: d.exercises });
        const synced = syncedRef.current[d.id];
        const cur = prev[d.id];
        if (synced === undefined || cur === undefined) {
          next[d.id] = { name: d.name, exercises: d.exercises.map((e) => ({ ...e })) };
          syncedRef.current[d.id] = serverJson;
        } else if (serverJson !== synced) {
          const curJson = JSON.stringify({ name: cur.name.trim(), exercises: cur.exercises });
          if (curJson === synced) {
            next[d.id] = { name: d.name, exercises: d.exercises.map((e) => ({ ...e })) };
            syncedRef.current[d.id] = serverJson;
          }
        }
      }
      return next;
    });
  }, [planQ.data]);

  const [newDayName, setNewDayName] = useState("");
  const [showNewDay, setShowNewDay] = useState(false);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [muscleFilter, setMuscleFilter] = useState<(typeof MUSCLE_FILTERS)[number]>("全部");
  const [gymDate, setGymDate] = useState(today);
  const [checkDone, setCheckDone] = useState<Record<string, boolean>>({});
  const [savedDayId, setSavedDayId] = useState<number | null>(null);
  const [checkedInDayId, setCheckedInDayId] = useState<number | null>(null);
  const [confirmDayDel, setConfirmDayDel] = useState<number | null>(null);
  const [confirmGymDel, setConfirmGymDel] = useState<number | null>(null);

  const createDay = useMutation({
    mutationFn: () => api.createWorkoutDay({ name: newDayName.trim() }),
    onSuccess: () => { void queryClient.invalidateQueries(); setNewDayName(""); setShowNewDay(false); },
  });
  const updateDay = useMutation({
    mutationFn: (dayId: number) => {
      const draft = drafts[dayId];
      if (!draft) throw new Error("no draft");
      return api.updateWorkoutDay({ id: dayId, name: draft.name.trim(), exercises: draft.exercises });
    },
    onSuccess: (_res, dayId) => {
      const draft = drafts[dayId];
      if (draft) syncedRef.current[dayId] = JSON.stringify({ name: draft.name.trim(), exercises: draft.exercises });
      setSavedDayId(dayId);
      void queryClient.invalidateQueries();
    },
  });
  const deleteDay = useMutation({
    mutationFn: (id: number) => api.deleteWorkoutDay({ id }),
    onSuccess: () => { void queryClient.invalidateQueries(); setConfirmDayDel(null); },
  });
  const checkIn = useMutation({
    mutationFn: (dayId: number) => {
      const draft = drafts[dayId];
      if (!draft) throw new Error("no draft");
      return api.addGymSession({
        date: gymDate,
        workoutDayId: dayId,
        dayName: draft.name.trim(),
        exercises: draft.exercises.map((e) => ({
          name: e.name,
          done: checkDone[`${dayId}:${e.name}`] ?? true,
          sets: e.sets,
          reps: e.reps,
        })),
        note: "",
      });
    },
    onSuccess: (_res, dayId) => { setCheckedInDayId(dayId); void queryClient.invalidateQueries(); },
  });
  const delGym = useMutation({ mutationFn: (id: number) => api.deleteGymSession({ id }), onSuccess: () => void queryClient.invalidateQueries() });

  const patchDraft = (dayId: number, patch: Partial<WorkoutDayDraft>) =>
    setDrafts((prev) => (prev[dayId] ? { ...prev, [dayId]: { ...prev[dayId], ...patch } } : prev));
  const patchExercise = (dayId: number, idx: number, patch: Partial<PlanExerciseDraft>) =>
    setDrafts((prev) => {
      const d = prev[dayId];
      if (!d) return prev;
      return { ...prev, [dayId]: { ...d, exercises: d.exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e)) } };
    });
  const moveExercise = (dayId: number, idx: number, dir: -1 | 1) =>
    setDrafts((prev) => {
      const d = prev[dayId];
      if (!d) return prev;
      const j = idx + dir;
      if (j < 0 || j >= d.exercises.length) return prev;
      const arr = [...d.exercises];
      const [item] = arr.splice(idx, 1);
      if (!item) return prev;
      arr.splice(j, 0, item);
      return { ...prev, [dayId]: { ...d, exercises: arr } };
    });
  const addExerciseToDay = (dayId: number, ex: Exercise) => {
    setDrafts((prev) => {
      const d = prev[dayId];
      if (!d || d.exercises.some((e) => e.name === ex.name)) return prev;
      return { ...prev, [dayId]: { ...d, exercises: [...d.exercises, { name: ex.name, sets: 4, reps: "12" }] } };
    });
  };
  const isDirty = (dayId: number): boolean => {
    const draft = drafts[dayId];
    const base = syncedRef.current[dayId];
    if (!draft || base === undefined) return false;
    return JSON.stringify({ name: draft.name.trim(), exercises: draft.exercises }) !== base;
  };

  const data = q.data;
  const pickerDay = pickerFor != null ? serverDays.find((d) => d.id === pickerFor) : undefined;
  const pickerDraft = pickerFor != null ? drafts[pickerFor] : undefined;
  const libraryFiltered = muscleFilter === "全部" ? EXERCISE_LIBRARY : EXERCISE_LIBRARY.filter((e) => e.muscle === muscleFilter);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--text)]">健身</h2>
        <p className="mt-1 text-sm text-[var(--dim)]">训练计划两种来法：去「目标」页一键生成你的三分化（胸+三头 / 背+二头 / 肩+腹，练三休一）；或者在这里自己新建训练日，从动作库挑动作组。生成的也能随便改。</p>
      </div>

      <section className="space-y-3" id="my-plan">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-lg font-bold text-[var(--text)]">我的训练计划</h3>
          <button type="button" onClick={() => setShowNewDay((v) => !v)} aria-expanded={showNewDay} className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white">＋ 新建训练日</button>
        </div>

        {showNewDay && (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <label className="block text-xs text-[var(--dim)]">训练日名字（自己起，比如：推日、拉日、周一练胸）
              <input value={newDayName} onChange={(e) => setNewDayName(e.target.value)} placeholder="给这个训练日起个名" aria-label="新训练日名字" className="mt-1.5 w-full rounded-xl bg-[var(--surface-alt)] px-3 py-2.5 text-base text-[var(--text)] outline-none placeholder:text-[var(--dim)]" />
            </label>
            <button type="button" disabled={newDayName.trim() === "" || createDay.isPending} onClick={() => createDay.mutate()} className="mt-3 w-full rounded-2xl bg-[var(--accent)] py-3 text-base font-semibold text-white disabled:opacity-40">{createDay.isPending ? "创建中…" : "创建训练日，然后往里加动作"}</button>
            {createDay.isError && <p className="mt-2 text-center text-sm text-[var(--danger)]">创建失败，再试一次。</p>}
          </div>
        )}

        {planQ.isPending && <p className="py-6 text-center text-sm text-[var(--dim)]">加载中…</p>}
        {planQ.isError && <p className="py-6 text-center text-sm text-[var(--danger)]">训练计划没加载出来，点底部「健身」再试。</p>}
        {planQ.data && serverDays.length === 0 && !showNewDay && (
          <p className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm leading-relaxed text-[var(--dim)]">
            还没建训练计划。去「目标」页填好你的状态可以一键生成一份；也可以点右上角「＋ 新建训练日」，从下面的动作库里挑动作自己组。
          </p>
        )}

        <label className="block text-xs text-[var(--dim)]">打卡日期（下面每个训练日的「打卡」都记到这天）
          <input type="date" value={gymDate} onChange={(e) => setGymDate(e.target.value)} aria-label="健身打卡日期" className="mt-1 w-full rounded-xl bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none" />
        </label>

        {serverDays.map((day) => {
          const draft = drafts[day.id];
          if (!draft) return null;
          const dirty = isDirty(day.id);
          const totalSets = draft.exercises.reduce((s, e) => s + (e.sets || 0), 0);
          return (
            <article key={day.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center gap-2">
                <input value={draft.name} onChange={(e) => { patchDraft(day.id, { name: e.target.value }); setSavedDayId(null); }} aria-label={`${day.name}的名字，可修改`} className="min-w-0 flex-1 rounded-xl bg-[var(--surface-alt)] px-3 py-2 text-base font-semibold text-[var(--text)] outline-none" />
                <span className="shrink-0 text-xs tabular-nums text-[var(--dim)]">{draft.exercises.length} 个动作 · {totalSets} 组</span>
              </div>

              {draft.exercises.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-[var(--border)] px-3 py-5 text-center text-sm text-[var(--dim)]">这个训练日还没有动作，点下面「＋ 添加动作」从动作库里挑。</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {draft.exercises.map((e, idx) => {
                    const lib = exerciseByName(e.name);
                    const checkKey = `${day.id}:${e.name}`;
                    return (
                      <li key={`${e.name}-${idx}`} className="rounded-2xl border border-[var(--border)] p-2.5">
                        <div className="flex items-center gap-3">
                          {lib ? (
                            <button type="button" onClick={() => setDetail(lib)} aria-label={`查看${e.name}的动作详情`} className="shrink-0">
                              <img src={lib.gif} alt={`${e.name}演示动图`} className="h-14 w-14 rounded-xl object-cover" loading="lazy" />
                            </button>
                          ) : (
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-alt)] text-xs text-[var(--dim)]">动作</span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[var(--text)]">{e.name}{lib && <span className="ml-1.5 text-xs font-normal text-[var(--dim)]">{lib.muscle}</span>}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--dim)]">
                              <label className="flex items-center gap-1">
                                <input value={String(e.sets)} onChange={(ev) => patchExercise(day.id, idx, { sets: Math.max(1, Math.min(20, parseInt(ev.target.value, 10) || 1)) })} inputMode="numeric" aria-label={`${e.name}的组数`} className="w-12 rounded-lg bg-[var(--surface-alt)] px-2 py-1.5 text-center text-sm tabular-nums text-[var(--text)] outline-none" />
                                组 ×
                              </label>
                              <label className="flex items-center gap-1">
                                <input value={e.reps} onChange={(ev) => patchExercise(day.id, idx, { reps: ev.target.value })} inputMode="numeric" aria-label={`${e.name}每组次数`} className="w-12 rounded-lg bg-[var(--surface-alt)] px-2 py-1.5 text-center text-sm tabular-nums text-[var(--text)] outline-none" />
                                次
                              </label>
                              <label className="flex cursor-pointer items-center gap-1 text-[var(--text)]">
                                <input type="checkbox" checked={checkDone[checkKey] ?? true} onChange={(ev) => setCheckDone((prev) => ({ ...prev, [checkKey]: ev.target.checked }))} aria-label={`${e.name}今天完成了`} className="h-4 w-4 accent-[var(--accent)]" />
                                完成
                              </label>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-center gap-1">
                            <span className="flex gap-1">
                              <button type="button" onClick={() => moveExercise(day.id, idx, -1)} disabled={idx === 0} aria-label={`把${e.name}上移`} className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-alt)] text-xs text-[var(--dim)] disabled:opacity-30">↑</button>
                              <button type="button" onClick={() => moveExercise(day.id, idx, 1)} disabled={idx === draft.exercises.length - 1} aria-label={`把${e.name}下移`} className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-alt)] text-xs text-[var(--dim)] disabled:opacity-30">↓</button>
                            </span>
                            <button type="button" onClick={() => { patchDraft(day.id, { exercises: draft.exercises.filter((_, i) => i !== idx) }); setSavedDayId(null); }} aria-label={`从${draft.name}移除${e.name}`} className="text-xs text-[var(--danger)]">移除</button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPickerFor(day.id)} className="rounded-2xl bg-[var(--accent-soft)] py-2.5 text-sm font-semibold text-[var(--accent)]">＋ 添加动作</button>
                <button type="button" disabled={!dirty || draft.name.trim() === "" || updateDay.isPending} onClick={() => updateDay.mutate(day.id)} className="rounded-2xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                  {updateDay.isPending && updateDay.variables === day.id ? "保存中…" : savedDayId === day.id && !dirty ? "已保存" : "保存修改"}
                </button>
              </div>
              {updateDay.isError && updateDay.variables === day.id && <p className="mt-2 text-center text-sm text-[var(--danger)]">保存失败，再试一次。</p>}

              <button type="button" disabled={draft.exercises.length === 0 || checkIn.isPending} onClick={() => checkIn.mutate(day.id)} className="mt-2 w-full rounded-2xl border border-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--accent)] disabled:opacity-40">
                {checkIn.isPending && checkIn.variables === day.id ? "打卡中…" : checkedInDayId === day.id ? `已打卡 · ${dayLabel(gymDate)}练了「${draft.name}」` : `打卡 · ${dayLabel(gymDate)}练了这个`}
              </button>
              {checkIn.isError && checkIn.variables === day.id && <p className="mt-2 text-center text-sm text-[var(--danger)]">打卡失败，再试一次。</p>}

              <div className="mt-3 text-right">
                {confirmDayDel === day.id ? (
                  <span className="flex justify-end gap-3 text-xs">
                    <button type="button" onClick={() => deleteDay.mutate(day.id)} className="font-semibold text-[var(--danger)]">确认删除这个训练日</button>
                    <button type="button" onClick={() => setConfirmDayDel(null)} className="text-[var(--dim)]">取消</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmDayDel(day.id)} aria-label={`删除训练日${draft.name}`} className="text-xs text-[var(--dim)]">删除这个训练日</button>
                )}
              </div>
            </article>
          );
        })}

        {data && data.gymSessions.length > 0 && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-4">
            <h4 className="pt-3 text-sm font-semibold text-[var(--text)]">最近健身记录</h4>
            <ul className="divide-y divide-[var(--border)]">
              {data.gymSessions.slice(0, 10).map((s) => {
                const doneCount = s.exercises.filter((e) => e.done).length;
                return (
                  <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-[var(--text)]">{dayLabel(s.date)} · {s.dayName ?? "健身打卡"}<span className="ml-2 text-xs text-[var(--dim)]">完成 {doneCount}/{s.exercises.length} 个动作</span></span>
                    {confirmGymDel === s.id ? <span className="flex gap-2 text-xs"><button type="button" onClick={() => delGym.mutate(s.id)} className="font-semibold text-[var(--danger)]">确认删除</button><button type="button" onClick={() => setConfirmGymDel(null)} className="text-[var(--dim)]">取消</button></span> : <button type="button" onClick={() => setConfirmGymDel(s.id)} aria-label={`删除${s.date}的健身记录`} className="text-xs text-[var(--dim)]">删除</button>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </section>

      <section className="space-y-3" id="exercise-library">
        <div>
          <h3 className="font-display text-lg font-bold text-[var(--text)]">动作库</h3>
          <p className="mt-1 text-sm text-[var(--dim)]">{EXERCISE_LIBRARY.length} 个动作，覆盖胸、背、腿、臀、肩、手臂和核心，每个都有演示动图，点开有目标肌群、动作步骤和视频讲解。挑中意的加进你的训练日。</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="按部位筛动作">
          {MUSCLE_FILTERS.map((m) => (
            <button key={m} type="button" onClick={() => setMuscleFilter(m)} aria-pressed={muscleFilter === m} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${muscleFilter === m ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--dim)] shadow-sm"}`}>{m}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {libraryFiltered.map((e) => (
            <button key={e.name} type="button" onClick={() => setDetail(e)} aria-label={`查看${e.name}的动作详情`} className="rounded-3xl bg-[var(--surface)] p-3 text-left shadow-sm">
              <img src={e.gif} alt={`${e.name}演示动图`} className="h-28 w-full rounded-2xl object-cover" loading="lazy" />
              <span className="mt-2 block text-sm font-semibold text-[var(--text)]">{e.name}</span>
              <span className="mt-0.5 block text-xs text-[var(--dim)]">{e.muscle} · 点开看视频讲解</span>
            </button>
          ))}
        </div>
      </section>

      {q.isPending && <p className="py-6 text-center text-sm text-[var(--dim)]">加载中…</p>}

      {pickerFor != null && pickerDay && pickerDraft && (
        <Sheet title={`添加动作到「${pickerDraft.name}」`} onClose={() => setPickerFor(null)}>
          <ul className="space-y-2">
            {EXERCISE_LIBRARY.map((e) => {
              const added = pickerDraft.exercises.some((x) => x.name === e.name);
              return (
                <li key={e.name} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] p-2.5">
                  <button type="button" onClick={() => setDetail(e)} aria-label={`查看${e.name}的动作详情`} className="shrink-0">
                    <img src={e.gif} alt={`${e.name}演示动图`} className="h-14 w-14 rounded-xl object-cover" loading="lazy" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text)]">{e.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--dim)]">{e.muscle} · 点图看详情和视频</p>
                  </div>
                  <button type="button" disabled={added} onClick={() => { addExerciseToDay(pickerDay.id, e); setSavedDayId(null); }} aria-label={added ? `${e.name}已在${pickerDraft.name}里` : `把${e.name}加进${pickerDraft.name}`} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${added ? "bg-[var(--surface-alt)] text-[var(--dim)]" : "bg-[var(--accent)] text-white"}`}>
                    {added ? "已添加" : "添加"}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setPickerFor(null)} className="mt-4 w-full rounded-2xl bg-[var(--accent)] py-3 text-base font-semibold text-white">选好了，回去设组数和次数</button>
          <p className="mt-2 text-center text-xs text-[var(--dim)]">加完记得在训练日卡片上点「保存修改」，计划才会存下来。</p>
        </Sheet>
      )}

      {detail && (
        <Sheet title={detail.name} onClose={() => setDetail(null)}>
          <img src={detail.gif} alt={`${detail.name}演示动图`} className="max-h-72 w-full rounded-2xl object-contain" />
          <p className="mt-2 text-xs text-[var(--dim)]">{detail.gifSource}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-[var(--surface-alt)] px-2 py-2">
              <dt className="text-[11px] text-[var(--dim)]">目标肌群</dt>
              <dd className="mt-0.5 text-xs font-medium leading-snug text-[var(--text)]">{detail.target}</dd>
            </div>
            <div className="rounded-xl bg-[var(--surface-alt)] px-2 py-2">
              <dt className="text-[11px] text-[var(--dim)]">器械</dt>
              <dd className="mt-0.5 text-xs font-medium leading-snug text-[var(--text)]">{detail.equipment}</dd>
            </div>
            <div className="rounded-xl bg-[var(--surface-alt)] px-2 py-2">
              <dt className="text-[11px] text-[var(--dim)]">难度</dt>
              <dd className="mt-0.5 text-xs font-medium leading-snug text-[var(--text)]">{detail.level}</dd>
            </div>
          </dl>
          <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">动作步骤</h3>
          <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-[var(--text)]">
            {detail.cues.map((c, i) => (
              <li key={c} className="flex gap-2">
                <span className="font-display font-black text-[var(--accent)]">{i + 1}</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
          <a href={detail.videoUrl} target="_blank" rel="noreferrer" className="mt-4 block rounded-2xl bg-[var(--accent)] py-3.5 text-center text-base font-semibold text-white">
            看视频讲解 · {detail.videoTitle}
          </a>
          {serverDays.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-[var(--dim)]">加进我的训练日（默认 4 组 × 12 次，回去能改）：</p>
              {serverDays.map((d) => {
                const draft = drafts[d.id];
                const added = draft?.exercises.some((x) => x.name === detail.name) ?? false;
                return (
                  <button key={d.id} type="button" disabled={!draft || added} onClick={() => { addExerciseToDay(d.id, detail); setSavedDayId(null); }} aria-label={added ? `${detail.name}已在${d.name}里` : `把${detail.name}加进${d.name}`} className={`w-full rounded-2xl py-3 text-sm font-semibold ${added ? "bg-[var(--surface-alt)] text-[var(--dim)]" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}>
                    {added ? `已在「${d.name}」里` : `加入「${d.name}」`}
                  </button>
                );
              })}
              <p className="text-center text-xs text-[var(--dim)]">加完去训练日卡片点「保存修改」才会存下来。</p>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

const ACTIVITY_OPTIONS: { key: "sedentary" | "light" | "moderate" | "active" | "very_active"; label: string; factor: number; desc: string }[] = [
  { key: "sedentary", label: "久坐", factor: 1.2, desc: "基本不动，整天坐着" },
  { key: "light", label: "轻度活动", factor: 1.375, desc: "每周动 1–3 天" },
  { key: "moderate", label: "中等活动", factor: 1.55, desc: "每天约 10000 步，或每周练 3–5 天" },
  { key: "active", label: "高活动", factor: 1.725, desc: "每周练 6–7 天" },
  { key: "very_active", label: "很高活动", factor: 1.9, desc: "体力活或每天高强度训练" },
];

const GOAL_OPTIONS: { key: "fat_loss" | "muscle" | "shape" | "strength"; label: string; delta: number; perKg: number; desc: string }[] = [
  { key: "fat_loss", label: "减脂", delta: -300, perKg: 2.2, desc: "缺口约 300 大卡，蛋白拉高保住肌肉" },
  { key: "muscle", label: "增肌", delta: 250, perKg: 1.8, desc: "盈余约 250 大卡，慢慢长肌肉" },
  { key: "shape", label: "塑形", delta: -100, perKg: 2.0, desc: "小缺口，重在围度和线条" },
  { key: "strength", label: "力量", delta: 100, perKg: 1.8, desc: "小盈余，优先把大重量做起来" },
];
const EXPERIENCE_OPTIONS: { key: "beginner" | "some" | "advanced"; label: string }[] = [
  { key: "beginner", label: "新手" },
  { key: "some", label: "有基础" },
  { key: "advanced", label: "进阶" },
];
const EQUIPMENT_OPTIONS: { key: "gym" | "dumbbell" | "bodyweight"; label: string }[] = [
  { key: "gym", label: "健身房" },
  { key: "dumbbell", label: "一副哑铃" },
  { key: "bodyweight", label: "自重" },
];

function SettingsForm(props: { settings: DaySettings; onOpenFeedback?: () => void }) {
  const queryClient = useQueryClient();
  const s = props.settings;

  // --- Quick calculation (personal basics -> targets) ---
  // Inputs start from the saved profile; before the first calculation they
  // start from the user's own known basics (173cm / 66kg / 19 / 男 / 中等),
  // which he can change before calculating. Nothing is a target until he
  // taps 计算 and the server saves the computed numbers.
  const [height, setHeight] = useState(s.heightCm != null ? String(s.heightCm) : "173");
  const [weight, setWeight] = useState(s.weightKg != null ? String(s.weightKg) : "66");
  const [age, setAge] = useState(s.age != null ? String(s.age) : "19");
  const [sex, setSex] = useState<"male" | "female">(s.sex ?? "male");
  const [activity, setActivity] = useState<(typeof ACTIVITY_OPTIONS)[number]["key"]>(s.activityLevel ?? "moderate");
  const [quota, setQuota] = useState(s.spendBudgetCents != null ? String(s.spendBudgetCents / 100) : "");
  const [goal, setGoal] = useState<(typeof GOAL_OPTIONS)[number]["key"]>(s.goal ?? "fat_loss");
  const [experience, setExperience] = useState<"beginner" | "some" | "advanced">(s.experience ?? "beginner");
  // 三分化固定每周 3 个训练日（练三休一），不再让用户选天数。
  const [daysPerWeek] = useState<number>(3);
  const [equipment, setEquipment] = useState<"gym" | "dumbbell" | "bodyweight">(s.equipment ?? "gym");
  const [justCalculated, setJustCalculated] = useState(false);

  const preview = useMemo(() => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    const a = parseInt(age, 10);
    if (!h || !w || !a) return null;
    const bmr = 10 * w + 6.25 * h - 5 * a + (sex === "male" ? 5 : -161);
    const factor = ACTIVITY_OPTIONS.find((o) => o.key === activity)?.factor ?? 1.55;
    const tdee = bmr * factor;
    const g = GOAL_OPTIONS.find((o) => o.key === goal) ?? GOAL_OPTIONS[0]!;
    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      calorie: Math.max(1200, Math.round(tdee + g.delta)),
      delta: g.delta,
      goalLabel: g.label,
      perKg: g.perKg,
      proteinMin: Math.round(w * 1.6),
      proteinMax: Math.round(w * 2.0),
      protein: Math.round(w * g.perKg),
    };
  }, [height, weight, age, sex, activity, goal]);

  const calc = useMutation({
    mutationFn: () =>
      api.calculateTargets({
        heightCm: parseFloat(height) || 0,
        weightKg: parseFloat(weight) || 0,
        age: parseInt(age, 10) || 0,
        sex,
        activityLevel: activity,
        spendBudgetCents: quota.trim() === "" ? null : Math.round((parseFloat(quota) || 0) * 100),
        goal,
        experience,
        daysPerWeek,
        equipment,
      }),
    onSuccess: () => {
      setJustCalculated(true);
      void queryClient.invalidateQueries();
    },
  });
  const calcValid = preview != null && (parseFloat(height) || 0) >= 100 && (parseFloat(weight) || 0) >= 30 && (parseInt(age, 10) || 0) >= 10;

  // --- Manual fine-tuning of the three targets ---
  const [cal, setCal] = useState(s.calorieTarget != null ? String(s.calorieTarget) : "");
  const [pro, setPro] = useState(s.proteinTarget != null ? String(s.proteinTarget) : "");
  const [budget, setBudget] = useState(s.spendBudgetCents != null ? String(s.spendBudgetCents / 100) : "");
  const [saved, setSaved] = useState(false);
  const update = useMutation({
    mutationFn: () =>
      api.updateSettings({
        calorieTarget: Math.round(parseFloat(cal) || 0),
        proteinTarget: Math.round(parseFloat(pro) || 0),
        spendBudgetCents: budget.trim() === "" ? null : Math.round((parseFloat(budget) || 0) * 100),
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries();
    },
  });
  const calValid = (parseFloat(cal) || 0) >= 500;
  const proValid = (parseFloat(pro) || 0) >= 0 && pro.trim() !== "";

  // --- Plan generation from the saved profile ---
  const profileComplete = s.goal != null && s.experience != null;
  const [genConfirm, setGenConfirm] = useState(false);
  const [genResult, setGenResult] = useState<ApiResponse<typeof api, "generatePlan"> | null>(null);
  const gen = useMutation({
    mutationFn: () => api.generatePlan({}),
    onSuccess: (res) => {
      setGenResult(res);
      setGenConfirm(false);
      void queryClient.invalidateQueries();
    },
  });

  // --- Appearance: theme color + hero art ---
  const appearance = useMutation({
    mutationFn: (v: { themeColor: string; heroArt: string }) => api.updateAppearance(v),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  const curThemeKey = s.themeColor ?? "red";
  const curArtKey = s.heroArt ?? "barbell";

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-[var(--text)]">每日目标</h2>

      <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-base font-semibold text-[var(--text)]">快速计算 · 先填基本情况</h3>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          基础代谢用 Mifflin-St Jeor 公式算，乘活动系数得到每日总消耗，再按你的目标调：减脂 −300、增肌 +250、塑形 −100、力量 +100 大卡；蛋白质按目标取每公斤体重 1.8–2.2 克。下面再填训练档案，算完就能生成你的三分化健身计划。
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className="text-xs text-[var(--dim)]">身高 cm
            <input value={height} onChange={(e) => { setHeight(e.target.value); setJustCalculated(false); }} inputMode="decimal" aria-label="身高（厘米）" className="mt-1 w-full rounded-xl bg-[var(--surface-alt)] px-2 py-2.5 text-base tabular-nums text-[var(--text)] outline-none" />
          </label>
          <label className="text-xs text-[var(--dim)]">体重 kg
            <input value={weight} onChange={(e) => { setWeight(e.target.value); setJustCalculated(false); }} inputMode="decimal" aria-label="体重（公斤）" className="mt-1 w-full rounded-xl bg-[var(--surface-alt)] px-2 py-2.5 text-base tabular-nums text-[var(--text)] outline-none" />
          </label>
          <label className="text-xs text-[var(--dim)]">年龄
            <input value={age} onChange={(e) => { setAge(e.target.value); setJustCalculated(false); }} inputMode="numeric" aria-label="年龄" className="mt-1 w-full rounded-xl bg-[var(--surface-alt)] px-2 py-2.5 text-base tabular-nums text-[var(--text)] outline-none" />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2" role="group" aria-label="性别">
          <span className="text-xs text-[var(--dim)]">性别</span>
          {([{ key: "male", label: "男" }, { key: "female", label: "女" }] as const).map((o) => (
            <button key={o.key} type="button" onClick={() => { setSex(o.key); setJustCalculated(false); }} aria-pressed={sex === o.key} className={`rounded-full px-5 py-1.5 text-sm font-medium ${sex === o.key ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-alt)] text-[var(--dim)]"}`}>{o.label}</button>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--dim)]">活动量</p>
        <div className="mt-1.5 space-y-1.5" role="group" aria-label="活动量">
          {ACTIVITY_OPTIONS.map((o) => (
            <button key={o.key} type="button" onClick={() => { setActivity(o.key); setJustCalculated(false); }} aria-pressed={activity === o.key} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${activity === o.key ? "bg-[var(--accent-soft)] text-[var(--text)]" : "bg-[var(--surface-alt)] text-[var(--dim)]"}`}>
              <span><span className="font-medium">{o.label}</span><span className="ml-2 text-xs">{o.desc}</span></span>
              <span className="tabular-nums text-xs">×{o.factor}</span>
            </button>
          ))}
        </div>
        <label className="mt-3 block text-xs text-[var(--dim)]">每天花费定额（元，自己定；不填就不设）
          <input value={quota} onChange={(e) => { setQuota(e.target.value); setJustCalculated(false); }} inputMode="decimal" placeholder="比如 50" aria-label="每天花费定额（元）" className="mt-1 w-full rounded-xl bg-[var(--surface-alt)] px-3 py-2.5 text-base tabular-nums text-[var(--text)] outline-none placeholder:text-[var(--dim)]" />
        </label>

        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <p className="text-sm font-medium text-[var(--text)]">训练档案 · 生成计划用</p>
          <p className="mt-2 text-xs text-[var(--dim)]">你的目标</p>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5" role="group" aria-label="训练目标">
            {GOAL_OPTIONS.map((o) => (
              <button key={o.key} type="button" onClick={() => { setGoal(o.key); setJustCalculated(false); }} aria-pressed={goal === o.key} className={`rounded-xl py-2 text-sm font-semibold ${goal === o.key ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-alt)] text-[var(--dim)]"}`}>{o.label}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-[var(--dim)]">{GOAL_OPTIONS.find((o) => o.key === goal)?.desc}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[var(--dim)]">训练经验</p>
              <div className="mt-1.5 flex gap-1.5" role="group" aria-label="训练经验">
                {EXPERIENCE_OPTIONS.map((o) => (
                  <button key={o.key} type="button" onClick={() => { setExperience(o.key); setJustCalculated(false); }} aria-pressed={experience === o.key} className={`flex-1 rounded-xl py-2 text-sm font-medium ${experience === o.key ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-alt)] text-[var(--dim)]"}`}>{o.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--dim)]">有什么器械</p>
              <div className="mt-1.5 flex gap-1.5" role="group" aria-label="可用器械">
                {EQUIPMENT_OPTIONS.map((o) => (
                  <button key={o.key} type="button" onClick={() => { setEquipment(o.key); setJustCalculated(false); }} aria-pressed={equipment === o.key} className={`flex-1 rounded-xl py-2 text-sm font-medium ${equipment === o.key ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-alt)] text-[var(--dim)]"}`}>{o.label}</button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-[var(--surface-alt)] px-3 py-2 text-xs leading-relaxed text-[var(--dim)]">
            计划固定为三分化，不用选天数：Day 1 胸+三头 · Day 2 背+二头 · Day 3 肩+腹，连练 3 天休 1 天，4 天一个循环滚动。
          </p>
        </div>

        {preview && (
          <div className="mt-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-3 text-sm leading-relaxed text-[var(--text)]">
            <p>基础代谢 <b className="tabular-nums">{preview.bmr}</b> 大卡 · 每日总消耗 <b className="tabular-nums">{preview.tdee}</b> 大卡</p>
            <p className="mt-1">{preview.goalLabel}热量目标 <b className="tabular-nums text-[var(--accent)]">{preview.calorie}</b> 大卡（总消耗 {preview.delta >= 0 ? "+" : "−"} {Math.abs(preview.delta)}）</p>
            <p className="mt-1">蛋白质目标 <b className="tabular-nums">{preview.protein}</b> 克（{preview.perKg} 克/公斤 · 常规区间 {preview.proteinMin}–{preview.proteinMax} 克）</p>
            {quota.trim() !== "" && <p className="mt-1">花费定额 <b className="tabular-nums">¥{quota}</b> / 天</p>}
          </div>
        )}
        <button type="button" disabled={!calcValid || calc.isPending} onClick={() => calc.mutate()} className="mt-3 w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-semibold text-white disabled:opacity-40">
          {calc.isPending ? "计算中…" : justCalculated ? "已算好，首页已换成这组目标" : "计算并设为我的目标"}
        </button>
        {calc.isError && <p className="mt-2 text-center text-sm text-[var(--danger)]">计算没保存成功，再试一次。</p>}
        {s.bmr != null && s.tdee != null && !justCalculated && (
          <p className="mt-2 text-center text-xs text-[var(--dim)]">当前生效：基础代谢 {Math.round(s.bmr)} · 总消耗 {Math.round(s.tdee)} · 热量目标 {s.calorieTarget ?? "—"} 大卡 · 蛋白目标 {s.proteinTarget ?? "—"} 克{s.proteinMin != null ? `（建议 ${s.proteinMin}–${s.proteinMax}）` : ""}</p>
        )}
      </section>

      <h3 className="mt-6 text-base font-semibold text-[var(--text)]">手动微调目标</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">算出来的数想再改，直接在这里改了保存，首页跟着变。</p>
      <div className="mt-3 space-y-3">
        <label className="block rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-sm font-medium text-[var(--text)]">热量目标（大卡/天）</span>
          <input value={cal} onChange={(e) => { setCal(e.target.value); setSaved(false); }} inputMode="numeric" placeholder="还没算，先用上面的快速计算" aria-label="每日热量目标（大卡）" className="mt-2 w-full rounded-xl bg-[var(--surface-alt)] px-3 py-2.5 font-display text-2xl font-bold tabular-nums text-[var(--text)] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[var(--dim)]" />
        </label>
        <label className="block rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-sm font-medium text-[var(--text)]">蛋白质目标（克/天）</span>
          <input value={pro} onChange={(e) => { setPro(e.target.value); setSaved(false); }} inputMode="numeric" placeholder="还没算，先用上面的快速计算" aria-label="每日蛋白质目标（克）" className="mt-2 w-full rounded-xl bg-[var(--surface-alt)] px-3 py-2.5 font-display text-2xl font-bold tabular-nums text-[var(--text)] outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[var(--dim)]" />
        </label>
        <label className="block rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-sm font-medium text-[var(--text)]">花费定额（元/天，自己定）</span>
          <input value={budget} onChange={(e) => { setBudget(e.target.value); setSaved(false); }} inputMode="decimal" placeholder="还没定" aria-label="每日花费定额（元），留空表示不设" className="mt-2 w-full rounded-xl bg-[var(--surface-alt)] px-3 py-2.5 font-display text-2xl font-bold tabular-nums text-[var(--text)] outline-none placeholder:text-base placeholder:font-normal placeholder:text-[var(--dim)]" />
        </label>
      </div>
      <div className="mt-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed text-[var(--dim)]">
        <p className="font-medium text-[var(--text)]">你的固定口径</p>
        <p className="mt-1">体重参考区间 63–66 kg · 目标体脂约 14–15% · 健身计划是你的三分化（下面一键生成），也能在「健身」页自己选动作组。</p>
      </div>
      <button type="button" disabled={!calValid || !proValid || update.isPending} onClick={() => update.mutate()} className="mt-4 w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-semibold text-white disabled:opacity-40">
        {update.isPending ? "保存中…" : saved ? "已保存" : "保存目标"}
      </button>
      {update.isError && <p className="mt-2 text-center text-sm text-[var(--danger)]">保存失败，再试一次。</p>}

      <section className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-base font-semibold text-[var(--text)]">生成我的三分化计划</h3>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          你的三分化：Day 1 胸+三头（5 个动作 · 20 组）、Day 2 背+二头（5 个动作 · 20 组）、Day 3 肩+腹（6 个动作 · 24 组），每个动作 4 组，次数和组间休息按你上面保存的目标来；练三休一滚动，不练腿。生成后在「健身」页能换动作、改组数、自己再加训练日。
        </p>
        {!profileComplete && (
          <p className="mt-3 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]">
            先在上面把目标和训练经验选好，点「计算并设为我的目标」保存，这里才能生成三分化计划。
          </p>
        )}
        {profileComplete && (
          <p className="mt-2 text-xs tabular-nums text-[var(--dim)]">
            当前档案：{GOAL_OPTIONS.find((o) => o.key === s.goal)?.label} · {EXPERIENCE_OPTIONS.find((o) => o.key === s.experience)?.label} · 三分化（练三休一）
          </p>
        )}
        {genConfirm ? (
          <div className="mt-3 rounded-2xl bg-[var(--danger-soft)] p-3">
            <p className="text-sm leading-relaxed text-[var(--text)]">生成会替换你现在全部的训练日（自己组的也会被换掉），确定吗？</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" disabled={gen.isPending} onClick={() => gen.mutate()} className="rounded-xl bg-[var(--danger)] py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                {gen.isPending ? "生成中…" : "确定生成"}
              </button>
              <button type="button" onClick={() => setGenConfirm(false)} className="rounded-xl bg-[var(--surface)] py-2.5 text-sm font-medium text-[var(--dim)]">先不生成</button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={!profileComplete || gen.isPending} onClick={() => { setGenResult(null); setGenConfirm(true); }} className="mt-3 w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-semibold text-white disabled:opacity-40">
            生成三分化计划
          </button>
        )}
        {gen.isError && <p className="mt-2 text-center text-sm text-[var(--danger)]">生成失败，再试一次。</p>}
        {genResult && !genResult.ok && (
          <p className="mt-3 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{genResult.error}</p>
        )}
        {genResult && genResult.ok && (
          <div className="mt-3 rounded-2xl bg-[var(--surface-alt)] p-3">
            <p className="text-sm font-semibold text-[var(--text)]">已生成 · {genResult.splitLabel}</p>
            <ul className="mt-2 space-y-1.5">
              {genResult.days.map((d) => (
                <li key={d.name} className="text-sm leading-relaxed text-[var(--text)]">
                  <b>{d.name}</b>
                  <span className="text-[var(--dim)]"> · {d.exercises.map((e) => `${e.name} ${e.sets}组×${e.reps}`).join("、")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">{genResult.restNote}</p>
            <p className="mt-2 text-xs text-[var(--dim)]">去「健身」页看计划、改动作和组数，每天练完在那里打卡。</p>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-base font-semibold text-[var(--text)]">外观 · 主题和配图</h3>
        <p className="mt-2 text-xs text-[var(--dim)]">主题颜色（整个界面跟着变）</p>
        <div className="mt-2 flex gap-3" role="group" aria-label="主题颜色">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => appearance.mutate({ themeColor: t.key, heroArt: curArtKey })}
              aria-pressed={curThemeKey === t.key}
              aria-label={`主题颜色：${t.label}`}
              className="flex flex-col items-center gap-1"
            >
              <span
                className={`h-10 w-10 rounded-full ${curThemeKey === t.key ? "ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--surface)]" : ""}`}
                style={{ background: t.accent }}
              />
              <span className={`text-[11px] ${curThemeKey === t.key ? "font-semibold text-[var(--text)]" : "text-[var(--dim)]"}`}>{t.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-[var(--dim)]">首页主卡片配图（左右滑动浏览，点一张应用）</p>
        <div className="mt-2">
          <SwipeCarousel ariaLabel="首页配图卡片，可左右滑动">
            {HERO_ART_OPTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => appearance.mutate({ themeColor: curThemeKey, heroArt: a.key })}
                aria-pressed={curArtKey === a.key}
                aria-label={`首页配图用「${a.label}」`}
                className="relative block w-full overflow-hidden rounded-3xl text-left"
              >
                <img src={a.img} alt={`${a.label}风格配图预览`} className="h-36 w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 to-transparent px-4 pb-3 pt-8">
                  <span className="text-sm font-semibold text-white">{a.label}</span>
                  {curArtKey === a.key && (
                    <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-semibold text-white">使用中</span>
                  )}
                </span>
              </button>
            ))}
          </SwipeCarousel>
        </div>
        {appearance.isError && <p className="mt-2 text-center text-sm text-[var(--danger)]">外观没保存成功，再试一次。</p>}
      </section>

      <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-base font-semibold text-[var(--text)]">意见反馈 · 提建议</h3>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          想要什么新功能、哪里用着不顺手，或者发现了问题，都可以在这里写下来。提交后会保存，你能随时回看自己提过的。
        </p>
        <button
          type="button"
          onClick={() => props.onOpenFeedback?.()}
          className="mt-3 w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-semibold text-white"
        >
          去提建议
        </button>
      </section>
    </div>
  );
}

type TabKey = "home" | "today" | "trends" | "fitness" | "weight" | "settings";

function HomeView(props: {
  go: (t: TabKey) => void;
  openMeal: (mode: "photo" | "manual") => void;
  openExpense: () => void;
  openTakeout: () => void;
  openFeedback: () => void;
  openDay: (date: string) => void;
}) {
  const queryClient = useQueryClient();
  const today = todayKey();
  const day = useQuery({ queryKey: ["day", today], queryFn: () => api.getDay({ date: today }) });
  const weights = useQuery({ queryKey: ["weights", shiftKey(today, -119), today], queryFn: () => api.getWeights({ from: shiftKey(today, -119), to: today }) });
  const fitness = useQuery({ queryKey: ["fitness", shiftKey(today, -119), today], queryFn: () => api.getFitness({ from: shiftKey(today, -119), to: today }) });
  const plan = useQuery({ queryKey: ["workoutPlan"], queryFn: () => api.getWorkoutPlan({}) });
  const appearance = useMutation({
    mutationFn: (v: { themeColor: string; heroArt: string }) => api.updateAppearance(v),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  const [heroTab, setHeroTab] = useState<"train" | "diet">("train");
  const data = day.data;
  const settings = data?.settings;
  const calorieTarget = settings?.calorieTarget ?? null;
  const hasTargets = calorieTarget != null && settings?.proteinTarget != null;
  const remaining = calorieTarget != null ? calorieTarget - (data?.totalCalories ?? 0) : 0;
  const over = calorieTarget != null && remaining < 0;
  const wEntries = weights.data?.entries ?? [];
  const latestWeight = wEntries[0];
  const prevWeight = wEntries[1];
  const weightDelta = latestWeight && prevWeight ? round1(latestWeight.weightKg - prevWeight.weightKg) : null;
  const spark = useMemo(
    () =>
      [...wEntries]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(-14)
        .map((e) => ({ label: e.date.slice(5), value: e.weightKg })),
    [wEntries],
  );
  const avg7 = useMemo(() => {
    if (wEntries.length === 0) return null;
    const last = wEntries.slice(0, 7);
    return round1(last.reduce((s, e) => s + e.weightKg, 0) / last.length);
  }, [wEntries]);
  const planDays = plan.data?.days ?? [];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
  const todayPlan = planDays.length > 0 ? planDays[dayOfYear % planDays.length] : undefined;
  const todayPlanSets = todayPlan?.exercises.reduce((s, e) => s + e.sets, 0) ?? 0;
  const gymToday = (fitness.data?.gymSessions ?? []).filter((s) => s.date === today);
  const art = heroArtByKey(settings?.heroArt);
  const curThemeKey = settings?.themeColor ?? "red";
  const curArtKey = settings?.heroArt ?? "barbell";
  const dietPct = hasTargets && calorieTarget ? Math.min(100, ((data?.totalCalories ?? 0) / calorieTarget) * 100) : 0;

  const heroCard = (
    <section className="relative h-full overflow-hidden rounded-3xl bg-[var(--surface)] shadow-sm">
      <img src={art.img} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/20" />
      <div className="relative flex h-full flex-col p-5">
        <div className="flex gap-1 self-start rounded-full bg-black/45 p-1" role="group" aria-label="主卡片内容切换">
          {(
            [
              { key: "train", label: "训练" },
              { key: "diet", label: "饮食" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setHeroTab(t.key)}
              aria-pressed={heroTab === t.key}
              className={`rounded-full px-4 py-1 text-sm font-semibold ${
                heroTab === t.key ? "bg-[var(--accent)] text-white" : "text-white/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {heroTab === "train" ? (
          <div className="mt-4 flex flex-1 flex-col">
            {plan.isPending ? (
              <p className="py-6 text-sm text-white/70">加载中…</p>
            ) : gymToday.length > 0 ? (
              <>
                <p className="text-sm font-medium text-white/70">今日训练 · 已完成</p>
                <p className="mt-1 font-display text-4xl font-black leading-tight text-white">
                  {gymToday.map((s) => s.dayName ?? "健身打卡").join("、")}
                </p>
                <p className="mt-1.5 text-sm text-white/70">已打卡 · 我的计划共 {planDays.length} 个训练日，轮着练</p>
                <button type="button" onClick={() => props.go("fitness")} className="mt-auto w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-bold text-white">
                  查看我的计划
                </button>
              </>
            ) : todayPlan ? (
              <>
                <p className="text-sm font-medium text-white/70">今日训练</p>
                <p className="mt-1 font-display text-4xl font-black leading-tight text-white">{todayPlan.name}</p>
                <p className="mt-1.5 text-sm tabular-nums text-white/85">
                  {todayPlan.exercises.length} 个动作 · {todayPlanSets} 组
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-white/60">
                  {todayPlan.exercises.map((e) => e.name).join(" · ")}
                </p>
                <button type="button" onClick={() => props.go("fitness")} className="mt-auto w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-bold text-white">
                  开始训练
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-white/70">今日训练</p>
                <p className="mt-1 font-display text-3xl font-black leading-tight text-white">还没有训练计划</p>
                <p className="mt-1.5 max-w-[240px] text-sm leading-relaxed text-white/70">
                  按你的目标、经验和器械生成一份，或自己从动作库选动作组。
                </p>
                <button type="button" onClick={() => props.go("settings")} className="mt-auto w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-bold text-white">
                  去生成我的计划
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-1 flex-col">
            {!hasTargets || !data ? (
              <>
                <p className="text-sm font-medium text-white/70">今日饮食</p>
                <p className="mt-1 font-display text-3xl font-black leading-tight text-white">先算出你每天能吃多少</p>
                <p className="mt-1.5 max-w-[240px] text-sm leading-relaxed text-white/70">
                  填身高体重算出热量和蛋白目标，这里就按算出来的数显示。
                </p>
                <button type="button" onClick={() => props.go("settings")} className="mt-auto w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-bold text-white">
                  去快速计算
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-white/70">{over ? "今日热量已超出" : "今日还能吃"}</p>
                <p className="mt-1 font-display text-5xl font-black tabular-nums leading-none text-white">
                  {Math.abs(Math.round(remaining))}
                  <span className="ml-2 font-sans text-base font-normal text-white/70">大卡</span>
                </p>
                <div className="mt-3 h-1.5 w-3/4 overflow-hidden rounded-full bg-white/20">
                  <div className={`h-full rounded-full ${over ? "bg-[var(--danger)]" : "bg-[var(--accent)]"}`} style={{ width: `${dietPct}%` }} />
                </div>
                <p className="mt-2 text-sm tabular-nums text-white/85">
                  已吃 {Math.round(data.totalCalories)} / {calorieTarget} 大卡 · 已记 {data.meals.length} 餐
                </p>
                <p className="mt-0.5 text-sm tabular-nums text-white/70">
                  蛋白 {round1(data.totalProtein)} 克 · 碳水 {round1(data.totalCarbs)} 克 · 脂肪 {round1(data.totalFat)} 克
                </p>
                <button type="button" onClick={() => props.openMeal("photo")} className="mt-auto w-full rounded-2xl bg-[var(--accent)] py-3.5 text-base font-bold text-white">
                  记一餐
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );

  const themeCard = (
    <section className="relative h-full overflow-hidden rounded-3xl bg-[var(--surface)] shadow-sm">
      <img src={art.img} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/30" />
      <div className="relative flex h-full flex-col p-5">
        <p className="text-sm font-medium text-white/70">外观</p>
        <p className="mt-1 font-display text-3xl font-black leading-tight text-white">换个主题</p>
        <p className="mt-3 text-xs text-white/60">主题颜色</p>
        <div className="mt-1.5 flex gap-2.5" role="group" aria-label="主题颜色">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => appearance.mutate({ themeColor: t.key, heroArt: curArtKey })}
              aria-pressed={curThemeKey === t.key}
              aria-label={`主题颜色：${t.label}`}
              className={`h-9 w-9 rounded-full ${curThemeKey === t.key ? "ring-2 ring-white ring-offset-2 ring-offset-black/60" : ""}`}
              style={{ background: t.accent }}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-white/60">卡片配图</p>
        <div className="mt-1.5 flex gap-2" role="group" aria-label="卡片配图">
          {HERO_ART_OPTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => appearance.mutate({ themeColor: curThemeKey, heroArt: a.key })}
              aria-pressed={curArtKey === a.key}
              aria-label={`配图用「${a.label}」`}
              className={`overflow-hidden rounded-xl ${curArtKey === a.key ? "ring-2 ring-white" : "opacity-75"}`}
            >
              <img src={a.img} alt={`${a.label}配图`} className="h-11 w-16 object-cover" />
            </button>
          ))}
        </div>
        <p className="mt-auto pt-3 text-xs text-white/50">左右滑这张卡片能切回训练卡 · 更多外观设置在「目标」页</p>
      </div>
    </section>
  );

  // Quick entries are deliberately NOT a tidy grid: a big tilted hero for
  // the primary photo entry, a round gold coin for spending, and the rest
  // scattered as pills / chips / a dashed outline at slight angles and
  // offsets, each with its own shape and color so the zone feels playful.
  const quick: {
    label: string;
    sub: string;
    action: () => void;
    deco: string;
    cls: string;
    labelCls: string;
    subCls: string;
    decoCls: string;
  }[] = [
    {
      label: "拍照记餐",
      sub: "拍一张，热量就算出来",
      action: () => props.openMeal("photo"),
      deco: "→",
      cls: "relative w-[calc(64%-6px)] min-h-[108px] -rotate-1 rounded-[28px] rounded-br-[10px] bg-[var(--accent)] px-4 py-4 text-left shadow-[6px_6px_0_rgba(0,0,0,0.45)]",
      labelCls: "text-white text-xl font-black",
      subCls: "text-white/75",
      decoCls: "bg-white text-[var(--accent)]",
    },
    {
      label: "记花费",
      sub: "记一笔",
      action: props.openExpense,
      deco: "¥",
      cls: "relative w-[calc(36%-6px)] min-h-[92px] translate-y-4 rotate-3 self-start rounded-full bg-[var(--gold)] px-2 py-4 text-center shadow-[4px_4px_0_rgba(0,0,0,0.4)]",
      labelCls: "text-black text-base font-black",
      subCls: "text-black/60",
      decoCls: "bg-black text-[var(--gold)]",
    },
    {
      label: "记饮食",
      sub: "手动加一餐",
      action: () => props.openMeal("manual"),
      deco: "＋",
      cls: "relative w-[calc(45%-6px)] min-h-[70px] rotate-1 rounded-2xl rounded-tl-[30px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-left",
      labelCls: "text-[var(--text)] text-base font-bold",
      subCls: "text-[var(--dim)]",
      decoCls: "bg-[var(--accent-soft)] text-[var(--accent)]",
    },
    {
      label: "外卖助手",
      sub: "按今天额度推荐",
      action: props.openTakeout,
      deco: "↗",
      cls: "relative w-[calc(55%-6px)] min-h-[70px] -rotate-2 self-center rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-center",
      labelCls: "text-[var(--accent)] text-base font-bold",
      subCls: "text-[var(--dim)]",
      decoCls: "bg-[var(--accent)] text-white",
    },
    {
      label: "今日明细",
      sub: "今天的每一餐",
      action: () => props.openDay(today),
      deco: "·",
      cls: "relative w-[calc(38%-6px)] min-h-[64px] -translate-y-1 rotate-2 rounded-[18px] rounded-tr-[26px] bg-[var(--surface)] px-3 py-3 text-left shadow-sm",
      labelCls: "text-[var(--text)] text-sm font-bold",
      subCls: "text-[var(--dim)]",
      decoCls: "bg-[var(--surface-alt)] text-[var(--accent)]",
    },
    {
      label: "历史图表",
      sub: "周趋势和记录",
      action: () => props.go("trends"),
      deco: "↗",
      cls: "relative w-[calc(62%-6px)] min-h-[64px] -rotate-1 rounded-full bg-[var(--surface)] px-5 py-3 text-left shadow-sm",
      labelCls: "text-[var(--text)] text-base font-bold",
      subCls: "text-[var(--dim)]",
      decoCls: "bg-[var(--accent-soft)] text-[var(--accent)]",
    },
    {
      label: "体重",
      sub: "晨起空腹 · 看周平均",
      action: () => props.go("weight"),
      deco: "kg",
      cls: "relative w-[calc(52%-6px)] min-h-[84px] rotate-2 rounded-[24px] rounded-bl-[8px] bg-[var(--surface-alt)] px-4 py-3 text-left shadow-[-4px_4px_0_rgba(0,0,0,0.35)]",
      labelCls: "text-[var(--text)] text-lg font-black",
      subCls: "text-[var(--dim)]",
      decoCls: "bg-[var(--gold)] text-black",
    },
    {
      label: "健身计划",
      sub: "计划和动作库",
      action: () => props.go("fitness"),
      deco: "→",
      cls: "relative w-[calc(48%-6px)] min-h-[72px] -translate-y-2 -rotate-2 self-start rounded-2xl rounded-br-[28px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left shadow-sm",
      labelCls: "text-[var(--text)] text-base font-bold",
      subCls: "text-[var(--dim)]",
      decoCls: "bg-[var(--accent)] text-white",
    },
    {
      label: "提建议",
      sub: "想要什么功能，写给我",
      action: props.openFeedback,
      deco: "✎",
      cls: "relative mx-auto w-[72%] min-h-[60px] -rotate-1 rounded-full border-2 border-dashed border-[var(--accent)] bg-transparent px-5 py-3 text-center",
      labelCls: "text-[var(--accent)] text-base font-bold",
      subCls: "text-[var(--dim)]",
      decoCls: "bg-[var(--accent-soft)] text-[var(--accent)]",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <p className="text-base font-medium text-[var(--text)]">{prettyDate(today)}</p>
        <p className="text-sm text-[var(--dim)]">{planDays.length > 0 ? `我的计划 · ${planDays.length} 个训练日` : ""}</p>
      </div>

      <SwipeCarousel ariaLabel="首页主卡片，可左右滑动切换训练卡和主题卡">
        {[heroCard, themeCard]}
      </SwipeCarousel>

      {day.isError && (
        <p className="rounded-2xl bg-[var(--danger-soft)] px-4 py-3 text-center text-sm text-[var(--danger)]">
          今日数据没加载出来，下拉或重开一次试试。
        </p>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">身体数据</h2>
          <button type="button" onClick={() => props.go("settings")} className="text-sm font-medium text-[var(--accent)]">
            编辑
          </button>
        </div>
        <div className="rounded-3xl bg-[var(--surface)] p-4 shadow-sm">
          <p className="mb-3 text-sm text-[var(--dim)]">今日热量 · 三大营养素</p>
          {data ? (
            <CalorieRing
              calories={data.totalCalories}
              protein={data.totalProtein}
              carbs={data.totalCarbs}
              fat={data.totalFat}
              target={calorieTarget}
            />
          ) : (
            <p className="py-6 text-center text-sm text-[var(--dim)]">加载中…</p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => props.go("weight")} className="rounded-3xl bg-[var(--surface)] p-4 text-left shadow-sm" aria-label="去体重页">
            <p className="text-xs text-[var(--dim)]">今日体重 · 晨起空腹</p>
            <p className="mt-1 font-display text-3xl font-black tabular-nums text-[var(--text)]">
              {latestWeight ? latestWeight.weightKg : "—"}
              {latestWeight && <span className="ml-1 text-sm font-normal text-[var(--dim)]">kg</span>}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-[var(--dim)]">
              {weightDelta != null
                ? `比上次 ${weightDelta > 0 ? "+" : ""}${weightDelta} kg · `
                : ""}
              {avg7 != null ? `近7次均线 ${avg7} kg` : "还没记体重"}
            </p>
            {spark.length >= 2 ? (
              <div className="mt-2 h-10 w-full" role="img" aria-label="体重趋势线">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spark} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--dim)]">再记一次就有趋势线了</p>
            )}
          </button>
          <div className="rounded-3xl bg-[var(--surface)] p-4 shadow-sm">
            <button type="button" onClick={() => props.openDay(today)} className="block w-full text-left" aria-label="查看今日花费明细">
              <p className="text-xs text-[var(--dim)]">今日花费</p>
              <p className="mt-1 font-display text-3xl font-black tabular-nums text-[var(--text)]">
                {data ? fmtMoney(data.totalSpendCents) : "—"}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-[var(--dim)]">
                {settings?.spendBudgetCents != null
                  ? `定额 ${fmtMoney(settings.spendBudgetCents)}${data && data.totalSpendCents > settings.spendBudgetCents ? " · 已超" : ""}`
                  : "还没定每日定额"}
              </p>
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline gap-2.5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">快捷入口</h2>
          <span className="inline-block -rotate-3 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
            随手点一个
          </span>
        </div>
        <div className="flex flex-wrap items-start gap-3 px-1 pb-3 pt-1">
          {quick.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              aria-label={item.label}
              className={`${item.cls} transition-transform duration-150 active:rotate-0 active:scale-95`}
            >
              <span
                aria-hidden="true"
                className={`absolute -right-1.5 -top-1.5 flex h-6 min-w-6 rotate-6 items-center justify-center rounded-full px-1 text-[11px] font-black ${item.decoCls}`}
              >
                {item.deco}
              </span>
              <span className={`block font-display leading-tight ${item.labelCls}`}>{item.label}</span>
              <span className={`mt-1 block text-[11px] leading-tight ${item.subCls}`}>{item.sub}</span>
            </button>
          ))}
        </div>
      </section>

      {data && data.meals.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-[var(--text)]">今天吃了什么</h2>
          <div className="space-y-3">
            {data.meals.slice(0, 2).map((m) => (<MealCard key={m.id} meal={m} />))}
          </div>
          <button type="button" onClick={() => props.openDay(today)} className="mt-3 w-full rounded-2xl bg-[var(--surface)] py-3 text-sm font-medium text-[var(--accent)] shadow-sm">看今日全部明细</button>
        </section>
      )}
      {data && data.meals.length === 0 && (
        <p className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--dim)]">今天还没记吃的。点上面「拍照记餐」，拍张照就能算热量。</p>
      )}

      <section className="rounded-3xl bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-[var(--text)]">有建议想说？</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">想要新功能、哪里不好用，都能在这里提，提完能回看。</p>
          </div>
          <button
            type="button"
            onClick={props.openFeedback}
            className="shrink-0 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            提建议
          </button>
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [tab, setTab] = useState<TabKey>("home");
  const [date, setDate] = useState(todayKey());
  const [sheet, setSheet] = useState<{ kind: "meal"; mode: "photo" | "manual" } | { kind: "expense" } | { kind: "takeout" } | { kind: "feedback" } | null>(null);
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings({}),
  });
  const theme = themeByKey(settingsQuery.data?.themeColor);

  return (
    <div
      className="min-h-screen bg-[var(--bg)] text-[var(--text)]"
      style={{ "--accent": theme.accent, "--accent-soft": theme.soft } as CSSProperties}
    >
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main className="mx-auto w-full max-w-lg px-4 pb-28 pt-4">
        {tab === "home" && (
          <HomeView
            go={(t) => setTab(t)}
            openMeal={(mode) => { setDate(todayKey()); setSheet({ kind: "meal", mode }); }}
            openExpense={() => { setDate(todayKey()); setSheet({ kind: "expense" }); }}
            openTakeout={() => setSheet({ kind: "takeout" })}
            openFeedback={() => setSheet({ kind: "feedback" })}
            openDay={(d) => { setDate(d); setTab("today"); }}
          />
        )}
        {tab === "today" && (
          <TodayView
            date={date}
            setDate={setDate}
            openMeal={() => setSheet({ kind: "meal", mode: "photo" })}
            openExpense={() => setSheet({ kind: "expense" })}
            openTakeout={() => setSheet({ kind: "takeout" })}
            goSettings={() => setTab("settings")}
          />
        )}
        {tab === "trends" && (
          <TrendsView
            openDay={(d) => {
              setDate(d);
              setTab("today");
            }}
          />
        )}
        {tab === "fitness" && <FitnessView />}
        {tab === "weight" && <WeightView />}
        {tab === "settings" &&
          (settingsQuery.data ? (
            <SettingsForm
              key={JSON.stringify(settingsQuery.data)}
              settings={settingsQuery.data}
              onOpenFeedback={() => setSheet({ kind: "feedback" })}
            />
          ) : (
            <p className="py-16 text-center text-sm text-[var(--dim)]">加载中…</p>
          ))}
      </main>

      <nav
        aria-label="主导航"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] pb-safe"
      >
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {(
            [
              { key: "home", label: "首页" },
              { key: "today", label: "今日" },
              { key: "trends", label: "图表" },
              { key: "fitness", label: "健身" },
              { key: "weight", label: "体重" },
              { key: "settings", label: "目标" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`py-3.5 text-sm font-medium ${
                tab === t.key ? "text-[var(--accent)]" : "text-[var(--dim)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {sheet?.kind === "meal" && (
        <Sheet title={`记一餐 · ${dayLabel(date)}`} onClose={() => setSheet(null)}>
          <MealEditor key={sheet.mode} date={date} initialMode={sheet.mode} onDone={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet?.kind === "expense" && (
        <Sheet title={`记一笔 · ${dayLabel(date)}`} onClose={() => setSheet(null)}>
          <ExpenseForm date={date} onDone={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet?.kind === "takeout" && (
        <Sheet title="外卖点餐助手" onClose={() => setSheet(null)}>
          <TakeoutAssistant
            goSettings={() => {
              setSheet(null);
              setTab("settings");
            }}
          />
        </Sheet>
      )}
      {sheet?.kind === "feedback" && (
        <Sheet title="提建议" onClose={() => setSheet(null)}>
          <FeedbackForm onDone={() => setSheet(null)} />
        </Sheet>
      )}
    </div>
  );
}
