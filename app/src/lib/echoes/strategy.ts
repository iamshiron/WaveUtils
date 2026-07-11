/**
 * Types for the echo level-up strategy simulator.
 *
 * A {@link LevelUpStrategy} has two independent parts:
 *   • `target` — the flat "perfect echo" wishlist (≤5 desired substats + min
 *     values). It is a YARDSTICK ONLY: never consulted while leveling, only used
 *     afterwards to grade the plan (see {@link SimulationResult}).
 *   • `gates`  — a per-slot keep/discard policy. Each gate is a boolean tree over
 *     "is this substat present among the slots revealed so far". Passing every
 *     gate (all 5 slots) is the sole definition of a "kept" echo.
 *
 * Everything here is plain JSON (no classes, no functions) so a strategy crosses
 * the Web Worker `postMessage` boundary and serializes into a URL for free.
 */

import type { SubstatRequirement } from "./rollChance";
import type { SubstatId } from "./substats";

/** Resources consumed (or refunded) while leveling an echo. */
export interface ResourceVector {
	/** Echo EXP (supplied by Sealed Tubes). */
	readonly echoExp: number;
	/** Tuners (10 per substat unlock). */
	readonly tuners: number;
	/** Shell Credit (0.1 per EXP + 2000 per tuning). */
	readonly shellCredit: number;
}

/**
 * A keep-condition evaluated over the substats revealed so far. `present` is the
 * only leaf — "this substat type appears among the revealed slots" — composed
 * with the usual boolean operators. A discriminated union on `kind`, so the
 * evaluator is an exhaustive `switch` and the shape stays strictly type-safe.
 */
export type Gate =
	| { readonly kind: "present"; readonly substat: SubstatId }
	| { readonly kind: "and"; readonly conditions: readonly Gate[] }
	| { readonly kind: "or"; readonly conditions: readonly Gate[] }
	| { readonly kind: "not"; readonly condition: Gate };

/** Number of tuning stages / slot gates on a fully-leveled 5★ echo. */
export const STRATEGY_SLOTS = 5;

/** A full level-up plan: what "perfect" means, plus the per-slot keep policy. */
export interface LevelUpStrategy {
	readonly version: 1;
	/** Desired substats + min values (≤5). Grading yardstick only. */
	readonly target: readonly SubstatRequirement[];
	/**
	 * Keep-condition per slot 1..{@link STRATEGY_SLOTS} (index `i` is checked
	 * right after slot `i + 1` reveals). `null` means "no gate — always keep".
	 */
	readonly gates: readonly (Gate | null)[];
}

/** An empty gate list (no gate on any slot → nothing is ever discarded). */
export function emptyGates(): (Gate | null)[] {
	return Array.from({ length: STRATEGY_SLOTS }, () => null);
}

/** A blank strategy: no desired stats, no gates. */
export function defaultStrategy(): LevelUpStrategy {
	return { version: 1, target: [], gates: emptyGates() };
}

/**
 * Distribution of the net resources needed to acquire ONE perfect echo — i.e.
 * everything spent (after refunds) between consecutive perfect keeps. Kept
 * echoes each cost the identical full-level amount, so this per-acquisition
 * figure (which amortizes the discards farmed along the way) is where the
 * interesting variance lives.
 */
export interface ResourceStats {
	/** Mean resources per perfect echo. */
	readonly avg: ResourceVector;
	/** Cheapest observed acquisition (a lucky streak). */
	readonly min: ResourceVector;
	/** Most expensive observed acquisition (an unlucky streak). */
	readonly max: ResourceVector;
	/** Median acquisition cost. */
	readonly p50: ResourceVector;
	/** 90th-percentile acquisition cost. */
	readonly p90: ResourceVector;
}

/** One bar of the acquisition-cost histogram (bucketed on Echo EXP). */
export interface HistogramBin {
	/** Lower edge of the bucket, in Echo EXP. */
	readonly bucket: number;
	readonly count: number;
}

/**
 * Aggregate outcome of a Monte-Carlo run. Every field is a mergeable partial
 * (sums, mins, maxes, per-stage counts, histogram bins) so worker results
 * combine by simple addition.
 */
export interface SimulationResult {
	readonly samples: number;

	// --- Plan outcome (gates only) ---
	/** Echoes that passed all 5 gates (leveled to completion). */
	readonly kept: number;
	/** kept / samples — the "success rate" of the plan. */
	readonly keptRate: number;
	/** Echoes culled early by the plan. */
	readonly discarded: number;
	/** How many were culled at each slot (index 0 = slot 1). Length {@link STRATEGY_SLOTS}. */
	readonly discardsByStage: readonly number[];
	/** Average slot an echo reached before it was kept or discarded. */
	readonly avgStageReached: number;

	// --- Whole-run resource totals ---
	/** Total spent across every echo, before refunds. */
	readonly grossCost: ResourceVector;
	/** Total after recycling discards (75% EXP / 30% tuners back; no shell). */
	readonly netCost: ResourceVector;

	// --- Grading vs. the `target` yardstick (kept? × perfect? confusion matrix) ---
	/** Kept AND meets target — what you actually wanted. */
	readonly perfectKeeps: number;
	/** Kept but NOT perfect — plan too lenient (full spend on a dud). */
	readonly imperfectKeeps: number;
	/** Discarded but WOULD have been perfect — plan too aggressive. */
	readonly perfectButDiscarded: number;
	/** Discarded and not perfect — a correct cull. */
	readonly correctDiscards: number;

	// --- Acquisition efficiency (net resources per perfect echo) ---
	/** Distribution of resources spent to land one perfect echo. */
	readonly costPerPerfect: ResourceStats;
	/** netCost / perfectKeeps — the amortized headline cost per perfect echo. */
	readonly trueCostPerPerfect: ResourceVector;
	/** samples / perfectKeeps — raw echoes farmed per perfect one. */
	readonly echoesPerPerfect: number;

	// --- Baseline: never discard, level everything (what the plan competes against) ---
	readonly baselinePerfectRate: number;
	readonly baselineCostPerPerfect: ResourceVector;

	/** Histogram of per-acquisition Echo EXP, for charting. */
	readonly costHistogram: readonly HistogramBin[];
}
