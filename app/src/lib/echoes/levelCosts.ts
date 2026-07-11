/**
 * 5★ echo leveling economy — the resource cost of unlocking each substat.
 *
 * See `docs/Echo Leveling.md` for the full data. A substat is unlocked at every
 * 5th level (Lv 5/10/15/20/25); reaching each of those costs a chunk of Echo EXP
 * plus a flat tuning fee (10 Tuners + 2000 Shell Credit), and EXP itself costs
 * 0.1 Shell Credit per point.
 *
 * Refund model: we assume every discarded echo is **broken down directly** into
 * resources (nobody feeds echoes into other echoes as fodder). That returns 75%
 * of the Echo EXP and 30% of the Tuners; Shell Credit is never refunded. The EXP
 * comes back as Sealed Tubes (min 500 EXP each), so the sub-tube remainder — up
 * to 499 EXP — is lost on top of the 25% haircut.
 */

import type { ResourceVector } from "./strategy";

/** Shell Credit charged per point of Echo EXP. */
const SHELL_PER_EXP = 0.1;
/** Flat Shell Credit charged per tuning (substat unlock). */
const SHELL_PER_TUNE = 2000;
/** Tuners consumed per tuning. */
const TUNERS_PER_TUNE = 10;
/** Smallest Sealed Tube denomination, in Echo EXP — the refund payout granularity. */
const EXP_TUBE_MIN = 500;
/** Fraction of Echo EXP returned when an echo is broken down. */
const EXP_REFUND_RATE = 0.75;
/** Fraction of Tuners returned when an echo is broken down. */
const TUNER_REFUND_RATE = 0.3;

/**
 * Cumulative Echo EXP required to reach each 5★ tuning level. Index `i` is the
 * EXP to reach the level that unlocks substat `i + 1` (Lv 5/10/15/20/25).
 */
const CUMULATIVE_EXP = [4400, 16500, 39600, 79100, 142600] as const;

/** Number of substats / tuning stages on a fully-leveled 5★ echo. */
export const ECHO_MAX_STAGE = CUMULATIVE_EXP.length;

/** The all-zero resource vector. */
export const ZERO_RESOURCES: ResourceVector = {
	echoExp: 0,
	tuners: 0,
	shellCredit: 0,
};

/** Component-wise sum of two resource vectors. */
export function addResources(
	a: ResourceVector,
	b: ResourceVector,
): ResourceVector {
	return {
		echoExp: a.echoExp + b.echoExp,
		tuners: a.tuners + b.tuners,
		shellCredit: a.shellCredit + b.shellCredit,
	};
}

/** Component-wise `a - b`. */
export function subResources(
	a: ResourceVector,
	b: ResourceVector,
): ResourceVector {
	return {
		echoExp: a.echoExp - b.echoExp,
		tuners: a.tuners - b.tuners,
		shellCredit: a.shellCredit - b.shellCredit,
	};
}

/** Scales every component by `factor`. */
export function scaleResources(
	v: ResourceVector,
	factor: number,
): ResourceVector {
	return {
		echoExp: v.echoExp * factor,
		tuners: v.tuners * factor,
		shellCredit: v.shellCredit * factor,
	};
}

/** Marginal cost to unlock stage `i + 1` (Lv0→5, 5→10, …). */
function stageCost(stageIndex: number): ResourceVector {
	const previousExp = stageIndex === 0 ? 0 : CUMULATIVE_EXP[stageIndex - 1];
	const echoExp = CUMULATIVE_EXP[stageIndex] - previousExp;
	return {
		echoExp,
		tuners: TUNERS_PER_TUNE,
		shellCredit: echoExp * SHELL_PER_EXP + SHELL_PER_TUNE,
	};
}

/**
 * Marginal cost of each tuning stage: `STAGE_COSTS[i]` is the extra resources to
 * go from `i` unlocked substats to `i + 1`.
 */
export const STAGE_COSTS: readonly ResourceVector[] = CUMULATIVE_EXP.map(
	(_, index) => stageCost(index),
);

/**
 * Total resources to reach `stage` unlocked substats (0..{@link ECHO_MAX_STAGE}).
 * `cumulativeCostToStage(5)` is the full cost of maxing a 5★ echo.
 */
export function cumulativeCostToStage(stage: number): ResourceVector {
	const clamped = Math.max(0, Math.min(stage, ECHO_MAX_STAGE));
	let total = ZERO_RESOURCES;
	for (let i = 0; i < clamped; i++) {
		total = addResources(total, STAGE_COSTS[i]);
	}
	return total;
}

/**
 * Resources returned when an echo that cost `spent` is broken down: 75% of the
 * Echo EXP (paid in whole Sealed Tubes, so floored to a multiple of 500) and 30%
 * of the Tuners (floored). Shell Credit is never refunded.
 */
export function refund(spent: ResourceVector): ResourceVector {
	const refundableExp = spent.echoExp * EXP_REFUND_RATE;
	return {
		echoExp: Math.floor(refundableExp / EXP_TUBE_MIN) * EXP_TUBE_MIN,
		tuners: Math.floor(spent.tuners * TUNER_REFUND_RATE),
		shellCredit: 0,
	};
}
