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
	refund,
	scaleResources,
	subResources,
	ZERO_RESOURCES,
} from "./levelCosts";
import { mulberry32 } from "./prng";
import { type RandomSource, rollEcho } from "./simulate";
import {
	type GateSensitivity,
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
	/** Echoes that reached (paid to reveal) each slot. */
	reachedByStage: number[];
	/** Discards at each slot whose full roll would have been perfect. */
	perfectDiscardsByStage: number[];
	stageReachedSum: number;
	gross: ResourceVector;
	net: ResourceVector;
	perfectKeeps: number;
	imperfectKeeps: number;
	perfectButDiscarded: number;
	correctDiscards: number;
	/** Echoes whose full roll meets the target (independent of keep/discard). */
	perfectTotal: number;
	// Per-slot "remove this gate" counterfactual tallies (relax sensitivity).
	/** Echoes discarded at slot `i` that would be kept if gate `i` were removed. */
	relaxNewKeeps: number[];
	/** Of `relaxNewKeeps`, how many are perfect. */
	relaxNewPerfect: number[];
	/** Extra net resources from letting slot-`i` discards continue past a removed gate. */
	relaxAddedNet: ResourceVector[];
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
		reachedByStage: Array.from({ length: STRATEGY_SLOTS }, () => 0),
		perfectDiscardsByStage: Array.from({ length: STRATEGY_SLOTS }, () => 0),
		stageReachedSum: 0,
		gross: ZERO_RESOURCES,
		net: ZERO_RESOURCES,
		perfectKeeps: 0,
		imperfectKeeps: 0,
		perfectButDiscarded: 0,
		correctDiscards: 0,
		perfectTotal: 0,
		relaxNewKeeps: Array.from({ length: STRATEGY_SLOTS }, () => 0),
		relaxNewPerfect: Array.from({ length: STRATEGY_SLOTS }, () => 0),
		relaxAddedNet: Array.from({ length: STRATEGY_SLOTS }, () => ZERO_RESOURCES),
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
		const echo = rollEcho({ rng });
		const outcome = runEcho(strategy, echo);

		partial.samples++;
		partial.gross = addResources(partial.gross, outcome.spent);
		partial.net = addResources(partial.net, outcome.net);
		partial.stageReachedSum += outcome.stageReached;
		// An echo that reached slot `stageReached` paid to reveal slots 1..stageReached.
		for (let s = 0; s < outcome.stageReached; s++) {
			partial.reachedByStage[s]++;
		}
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
			const d = outcome.stageReached - 1;
			partial.discarded++;
			partial.discardsByStage[d]++;
			if (outcome.isPerfect) {
				partial.perfectButDiscarded++;
				partial.perfectDiscardsByStage[d]++;
			} else {
				partial.correctDiscards++;
			}
			// Counterfactual: removing gate `d` only changes echoes culled AT slot `d`
			// (earlier gates passed; later gates were never reached), so one replay
			// with that gate skipped gives the full "relax this gate" impact.
			const relaxed = runEcho(strategy, echo, d);
			if (relaxed.kept) {
				partial.relaxNewKeeps[d]++;
				if (outcome.isPerfect) {
					partial.relaxNewPerfect[d]++;
				}
			}
			partial.relaxAddedNet[d] = addResources(
				partial.relaxAddedNet[d],
				subResources(relaxed.net, outcome.net),
			);
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
		a.reachedByStage[i] += b.reachedByStage[i];
		a.perfectDiscardsByStage[i] += b.perfectDiscardsByStage[i];
		a.relaxNewKeeps[i] += b.relaxNewKeeps[i];
		a.relaxNewPerfect[i] += b.relaxNewPerfect[i];
		a.relaxAddedNet[i] = addResources(a.relaxAddedNet[i], b.relaxAddedNet[i]);
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

/** Net resources lost when an echo is discarded after reaching `stage` slots. */
function discardNetToStage(stage: number): ResourceVector {
	const spent = cumulativeCostToStage(stage);
	return subResources(spent, refund(spent));
}

/** Derives the final, display-ready result from a merged partial. */
export function finalize(
	partial: PartialResult,
	strategy: LevelUpStrategy,
): SimulationResult {
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

	// A discard at slot i (i+1 tunings paid) loses a fixed net amount, so the
	// resources wasted there are just the discard count times that unit cost.
	const wastedByStage: ResourceVector[] = partial.discardsByStage.map(
		(count, index) => scaleResources(discardNetToStage(index + 1), count),
	);

	const gateSensitivity: GateSensitivity[] = partial.relaxNewKeeps.map(
		(newKeeps, index) => ({
			hasGate: strategy.gates[index] != null,
			recoversPerfect: partial.relaxNewPerfect[index],
			addsImperfect: newKeeps - partial.relaxNewPerfect[index],
			newKeeps,
			addedNet: partial.relaxAddedNet[index],
		}),
	);

	return {
		samples,
		kept: partial.kept,
		keptRate: samples > 0 ? partial.kept / samples : 0,
		discarded: partial.discarded,
		discardsByStage: partial.discardsByStage.slice(),
		reachedByStage: partial.reachedByStage.slice(),
		perfectDiscardsByStage: partial.perfectDiscardsByStage.slice(),
		wastedByStage,
		gateSensitivity,
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
	return finalize(accumulate(strategy, samples, mulberry32(seed)), strategy);
}
