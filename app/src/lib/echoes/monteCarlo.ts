/**
 * Monte-Carlo core: roll many echoes, run each through a strategy, and fold the
 * outcomes into a {@link SimulationResult}.
 *
 * The accumulator is a {@link PartialResult} of raw sums / counts / histogram
 * bins so worker partials merge by simple addition; {@link finalize} then derives
 * the rates and per-echo figures. The interesting cost figure — resources to
 * acquire ONE perfect echo — is tracked as the net spend between consecutive
 * perfect keeps (a "pending" accumulator that resets each time one lands).
 */

import { runEcho } from "./evaluateStrategy";
import {
	addResources,
	cumulativeCostToStage,
	ECHO_MAX_STAGE,
	ZERO_RESOURCES,
} from "./levelCosts";
import { mulberry32 } from "./prng";
import { type RandomSource, rollEcho } from "./simulate";
import {
	type HistogramBin,
	type LevelUpStrategy,
	type ResourceStats,
	type ResourceVector,
	type SimulationResult,
	STRATEGY_SLOTS,
} from "./strategy";

/** Echo EXP in one fully-leveled 5★ — the histogram's bin width (1 "echo worth"). */
const FULL_ECHO_EXP = cumulativeCostToStage(ECHO_MAX_STAGE).echoExp;
/** Number of acquisition-cost histogram bins (last bin is an overflow bucket). */
const HISTOGRAM_BINS = 60;

/** A mergeable partial tally over some subset of the samples. */
export interface PartialResult {
	samples: number;
	kept: number;
	discarded: number;
	discardsByStage: number[];
	stageReachedSum: number;
	gross: ResourceVector;
	net: ResourceVector;
	perfectKeeps: number;
	imperfectKeeps: number;
	perfectButDiscarded: number;
	correctDiscards: number;
	/** Echoes whose full roll meets the target (independent of keep/discard). */
	perfectTotal: number;
	// Acquisition-cost distribution over COMPLETED acquisitions only.
	acqCount: number;
	acqSum: ResourceVector;
	acqMin: ResourceVector;
	acqMax: ResourceVector;
	acqHistogram: number[];
}

/** A fresh, empty partial. */
export function emptyPartial(): PartialResult {
	return {
		samples: 0,
		kept: 0,
		discarded: 0,
		discardsByStage: Array.from({ length: STRATEGY_SLOTS }, () => 0),
		stageReachedSum: 0,
		gross: ZERO_RESOURCES,
		net: ZERO_RESOURCES,
		perfectKeeps: 0,
		imperfectKeeps: 0,
		perfectButDiscarded: 0,
		correctDiscards: 0,
		perfectTotal: 0,
		acqCount: 0,
		acqSum: ZERO_RESOURCES,
		acqMin: { echoExp: Number.POSITIVE_INFINITY, tuners: 0, shellCredit: 0 },
		acqMax: { echoExp: Number.NEGATIVE_INFINITY, tuners: 0, shellCredit: 0 },
		acqHistogram: Array.from({ length: HISTOGRAM_BINS }, () => 0),
	};
}

function recordAcquisition(partial: PartialResult, cost: ResourceVector): void {
	partial.acqCount++;
	partial.acqSum = addResources(partial.acqSum, cost);
	if (cost.echoExp < partial.acqMin.echoExp) {
		partial.acqMin = cost;
	}
	if (cost.echoExp > partial.acqMax.echoExp) {
		partial.acqMax = cost;
	}
	const bin = Math.min(
		HISTOGRAM_BINS - 1,
		Math.floor(cost.echoExp / FULL_ECHO_EXP),
	);
	partial.acqHistogram[bin]++;
}

/**
 * Rolls `samples` echoes with `rng` and accumulates their outcomes into a
 * {@link PartialResult}. Pure and self-contained so it runs identically on the
 * main thread or inside a worker.
 */
export function accumulate(
	strategy: LevelUpStrategy,
	samples: number,
	rng: RandomSource,
	onProgress?: (done: number) => void,
): PartialResult {
	const partial = emptyPartial();
	let pending = ZERO_RESOURCES; // net spend since the last perfect keep

	for (let i = 0; i < samples; i++) {
		const outcome = runEcho(strategy, rollEcho({ rng }));

		partial.samples++;
		partial.gross = addResources(partial.gross, outcome.spent);
		partial.net = addResources(partial.net, outcome.net);
		partial.stageReachedSum += outcome.stageReached;
		if (outcome.isPerfect) {
			partial.perfectTotal++;
		}

		if (outcome.kept) {
			partial.kept++;
			if (outcome.isPerfect) {
				partial.perfectKeeps++;
			} else {
				partial.imperfectKeeps++;
			}
		} else {
			partial.discarded++;
			partial.discardsByStage[outcome.stageReached - 1]++;
			if (outcome.isPerfect) {
				partial.perfectButDiscarded++;
			} else {
				partial.correctDiscards++;
			}
		}

		pending = addResources(pending, outcome.net);
		if (outcome.kept && outcome.isPerfect) {
			recordAcquisition(partial, pending);
			pending = ZERO_RESOURCES;
		}

		if (onProgress && (i & 4095) === 4095) {
			onProgress(i + 1);
		}
	}

	onProgress?.(samples);
	return partial;
}

/** Merges `b` into `a` (component-wise) and returns `a`. */
export function mergeInto(a: PartialResult, b: PartialResult): PartialResult {
	a.samples += b.samples;
	a.kept += b.kept;
	a.discarded += b.discarded;
	for (let i = 0; i < a.discardsByStage.length; i++) {
		a.discardsByStage[i] += b.discardsByStage[i];
	}
	a.stageReachedSum += b.stageReachedSum;
	a.gross = addResources(a.gross, b.gross);
	a.net = addResources(a.net, b.net);
	a.perfectKeeps += b.perfectKeeps;
	a.imperfectKeeps += b.imperfectKeeps;
	a.perfectButDiscarded += b.perfectButDiscarded;
	a.correctDiscards += b.correctDiscards;
	a.perfectTotal += b.perfectTotal;
	a.acqCount += b.acqCount;
	a.acqSum = addResources(a.acqSum, b.acqSum);
	if (b.acqMin.echoExp < a.acqMin.echoExp) {
		a.acqMin = b.acqMin;
	}
	if (b.acqMax.echoExp > a.acqMax.echoExp) {
		a.acqMax = b.acqMax;
	}
	for (let i = 0; i < a.acqHistogram.length; i++) {
		a.acqHistogram[i] += b.acqHistogram[i];
	}
	return a;
}

/** Merges a set of partials into one. */
export function mergePartials(
	partials: readonly PartialResult[],
): PartialResult {
	return partials.reduce(mergeInto, emptyPartial());
}

function divide(v: ResourceVector, n: number): ResourceVector {
	if (n <= 0) {
		return {
			echoExp: Number.POSITIVE_INFINITY,
			tuners: Number.POSITIVE_INFINITY,
			shellCredit: Number.POSITIVE_INFINITY,
		};
	}
	return {
		echoExp: v.echoExp / n,
		tuners: v.tuners / n,
		shellCredit: v.shellCredit / n,
	};
}

/** Derives the final, display-ready result from a merged partial. */
export function finalize(partial: PartialResult): SimulationResult {
	const { samples, perfectKeeps, perfectTotal, acqCount } = partial;
	const fullCost = cumulativeCostToStage(ECHO_MAX_STAGE);

	const costPerPerfect: ResourceStats = {
		count: acqCount,
		avg: acqCount > 0 ? divide(partial.acqSum, acqCount) : ZERO_RESOURCES,
		min: acqCount > 0 ? partial.acqMin : ZERO_RESOURCES,
		max: acqCount > 0 ? partial.acqMax : ZERO_RESOURCES,
	};

	const costHistogram: HistogramBin[] = partial.acqHistogram.map(
		(count, index) => ({ bucket: index * FULL_ECHO_EXP, count }),
	);

	return {
		samples,
		kept: partial.kept,
		keptRate: samples > 0 ? partial.kept / samples : 0,
		discarded: partial.discarded,
		discardsByStage: partial.discardsByStage.slice(),
		avgStageReached: samples > 0 ? partial.stageReachedSum / samples : 0,
		grossCost: partial.gross,
		netCost: partial.net,
		perfectKeeps,
		imperfectKeeps: partial.imperfectKeeps,
		perfectButDiscarded: partial.perfectButDiscarded,
		correctDiscards: partial.correctDiscards,
		costPerPerfect,
		trueCostPerPerfect: divide(partial.net, perfectKeeps),
		echoesPerPerfect:
			perfectKeeps > 0 ? samples / perfectKeeps : Number.POSITIVE_INFINITY,
		baselinePerfectRate: samples > 0 ? perfectTotal / samples : 0,
		// Baseline = level every echo fully: cost = samples × fullCost, perfect = perfectTotal.
		baselineCostPerPerfect:
			perfectTotal > 0
				? divide(
						{
							echoExp: fullCost.echoExp * samples,
							tuners: fullCost.tuners * samples,
							shellCredit: fullCost.shellCredit * samples,
						},
						perfectTotal,
					)
				: divide(ZERO_RESOURCES, 0),
		costHistogram,
	};
}

/** Single-threaded convenience: roll `samples` echoes from `seed` and finalize. */
export function simulate(
	strategy: LevelUpStrategy,
	samples: number,
	seed = 1,
): SimulationResult {
	return finalize(accumulate(strategy, samples, mulberry32(seed)));
}
