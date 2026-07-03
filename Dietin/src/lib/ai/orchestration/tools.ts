/**
 * AI Agent tool definitions.
 *
 * This module exposes the concrete tool set available to the orchestration
 * layer. Tools are plain async functions and are kept free of React or UI
 * dependencies so they can run in any JavaScript environment.
 */

import {
  buildKnowledgeContext,
  serializeKnowledgeContext,
} from "../knowledge/base";
import type {
  CalorieEntry,
  DateKey,
  KnowledgeContext,
  PersonalRecord,
  ProgressPhoto,
  WeeklyReport,
} from "../knowledge/types";

/**
 * Union of all tool names exposed by the agent.
 */
export type ToolName = "readDailyData" | "writePlan";

/**
 * Extract the calendar date portion (YYYY-MM-DD) from an ISO 8601 timestamp.
 *
 * @param timestamp - ISO timestamp, e.g. "2024-05-21T08:30:00Z".
 * @returns The local calendar date, or an empty string when invalid.
 */
function toDateKey(timestamp: string | null | undefined): DateKey {
  if (!timestamp) {
    return "";
  }
  try {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) {
      return "";
    }
    // Use local calendar date to match how stores key daily data.
    const offsetMs = d.getTimezoneOffset() * 60_000;
    const local = new Date(d.getTime() - offsetMs);
    return local.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/**
 * Return today's calendar date in the local timezone as YYYY-MM-DD.
 */
function todayDateKey(): DateKey {
  return toDateKey(new Date().toISOString());
}

/**
 * Determine whether a weekly report covers the given calendar date.
 */
function reportCoversDate(report: WeeklyReport, date: DateKey): boolean {
  return report.weekStart <= date && report.weekEnd >= date;
}

/**
 * Filter PR history entries to those recorded on the target date.
 */
function filterPersonalRecord(
  record: PersonalRecord,
  date: DateKey,
): PersonalRecord {
  const matchingHistory = record.history.filter((attempt) => attempt.date === date);
  if (matchingHistory.length === record.history.length) {
    return record;
  }
  return { ...record, history: matchingHistory };
}

/**
 * Build a date-specific subset of the full knowledge context.
 *
 * Keeps the full user profile and runtime nutrition state, but limits
 * progress, meal logs, and hydration logs to entries that match the
 * requested calendar date.
 *
 * @param ctx - Full knowledge context assembled from stores.
 * @param date - Target calendar date in YYYY-MM-DD format.
 * @returns A compact, date-scoped knowledge context.
 */
function buildDailyContext(ctx: KnowledgeContext, date: DateKey): KnowledgeContext {
  const { user, nutrition, progress, workout, meal, hydration } = ctx;

  const dailyCalories = Object.prototype.hasOwnProperty.call(user.dailyCalories, date)
    ? { [date]: user.dailyCalories[date] }
    : {};

  const filterCalorieEntryByDate = (entry: CalorieEntry): boolean =>
    toDateKey(entry.timestamp) === date;

  const yearlyMeals: Record<number, CalorieEntry[]> = {};
  for (const [year, entries] of Object.entries(user.yearlyMeals)) {
    const filtered = entries.filter(filterCalorieEntryByDate);
    if (filtered.length > 0) {
      yearlyMeals[Number(year)] = filtered;
    }
  }

  const filteredProgress = {
    ...progress,
    weights: progress.weights.filter((entry) => entry.date === date),
    measurements: progress.measurements.filter((entry) => entry.date === date),
    photos: progress.photos.filter(
      (photo) => toDateKey(photo.capturedAt) === date,
    ),
    workouts: progress.workouts.filter((session) => session.date === date),
    prs: Object.entries(progress.prs).reduce<Record<string, PersonalRecord>>(
      (acc, [slug, record]) => {
        const filtered = filterPersonalRecord(record, date);
        if (filtered.history.length > 0) {
          acc[slug] = filtered;
        }
        return acc;
      },
      {},
    ),
    hydrationDaily: Object.prototype.hasOwnProperty.call(
      progress.hydrationDaily,
      date,
    )
      ? { [date]: progress.hydrationDaily[date] }
      : {},
    fitnessScores: progress.fitnessScores.filter((score) => score.date === date),
    weeklyReports: progress.weeklyReports.filter((report) =>
      reportCoversDate(report, date),
    ),
  };

  return {
    user: {
      ...user,
      dailyCalories,
      yearlyMeals,
    },
    nutrition,
    progress: filteredProgress,
    workout,
    meal,
    hydration,
  };
}

/**
 * Read the persisted daily data for a specific calendar date.
 *
 * When no date is provided, the current local calendar day is used.
 * The returned string is a compact, deterministic JSON serialization
 * suitable for inclusion in an LLM prompt.
 *
 * @param date - Optional target date in YYYY-MM-DD format.
 * @returns Compact JSON string of the filtered daily context.
 */
export async function readDailyData(date?: string): Promise<string> {
  const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayDateKey();
  const fullContext = buildKnowledgeContext();
  const dailyContext = buildDailyContext(fullContext, targetDate);
  return serializeKnowledgeContext(dailyContext);
}

/**
 * Write tool stub for persisting generated plans.
 *
 * This function intentionally performs no persistence during the ferment
 * phase. Use it to reserve the write tool shape in the agent contract.
 *
 * @param _planType - The kind of plan being written.
 * @param _payload - The plan payload.
 * @returns A result indicating the write tool is not yet implemented.
 */
export async function writePlan(
  _planType: string,
  _payload: unknown,
): Promise<{ ok: boolean; message: string }> {
  return {
    ok: false,
    message: "Write tool not implemented in this ferment.",
  };
}
