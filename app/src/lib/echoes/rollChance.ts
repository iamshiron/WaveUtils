/**
 * Analytic probability of rolling an echo whose substats satisfy a set of
 * "at least" requirements.
 *
 * The main stat is assumed already known and does not affect substats, so it
 * is deliberately absent from this model. Substat types are drawn without
 * replacement from the pool (every size-`slots` subset equally likely) and each
 * present substat's value is rolled independently, hence:
 *
 *   P = P(all required types present) × ∏ P(value ≥ min | present)
 *
 * where P(all required types present) = C(pool − k, slots − k) / C(pool, slots)
 * for k required substats.
 */

import {
	ECHO_SUBSTAT_SLOTS,
	getSubstat,
	SUBSTAT_POOL_SIZE,
	type SubstatId,
} from "./substats";

/** Tolerance so a threshold set exactly to a roll value stays inclusive despite float drift. */
const EPSILON = 1e-9;

/** A single "at least" requirement on a substat's rolled value. */
export interface SubstatRequirement {
	readonly substat: SubstatId;
	/** Inclusive minimum acceptable rolled value. */
	readonly min: number;
}

export interface RollChanceOptions {
	/** Number of substat slots on the echo. Defaults to 5 (fully-tuned 5★). */
	readonly slots?: number;
	/** Size of the substat pool. Defaults to the full pool (13). */
	readonly poolSize?: number;
}

/** Per-requirement breakdown of the value probability. */
export interface RequirementChance {
	readonly substat: SubstatId;
	readonly min: number;
	/** P(rolled value ≥ min | this substat is present). */
	readonly valueProbability: number;
}

export interface RollChanceResult {
	/** Overall probability the echo satisfies every requirement, in [0, 1]. */
	readonly probability: number;
	/** P(all required substats appear among the slots), independent of their values. */
	readonly presenceProbability: number;
	/** P(all present required substats meet their thresholds). */
	readonly valueProbability: number;
	/** Per-requirement value probabilities (duplicate substats merged to the strictest). */
	readonly perRequirement: readonly RequirementChance[];
}

/** n choose r, computed iteratively to avoid large factorials. */
function combinations(n: number, r: number): number {
	if (r < 0 || r > n) {
		return 0;
	}
	const k = Math.min(r, n - r);
	let result = 1;
	for (let i = 0; i < k; i++) {
		result = (result * (n - i)) / (i + 1);
	}
	return result;
}

/** P(a single roll of `substat` is ≥ `min`). */
export function substatValueChance(substat: SubstatId, min: number): number {
	return getSubstat(substat)
		.rolls.filter((roll) => roll.value >= min - EPSILON)
		.reduce((sum, roll) => sum + roll.weight, 0);
}

/** Computes the chance of rolling an echo whose substats satisfy every requirement. */
export function calculateRollChance(
	requirements: readonly SubstatRequirement[],
	options: RollChanceOptions = {},
): RollChanceResult {
	const slots = options.slots ?? ECHO_SUBSTAT_SLOTS;
	const poolSize = options.poolSize ?? SUBSTAT_POOL_SIZE;

	// Merge duplicate requirements on the same substat by taking the strictest threshold.
	const strictest = new Map<SubstatId, number>();
	for (const req of requirements) {
		const current = strictest.get(req.substat);
		strictest.set(
			req.substat,
			current === undefined ? req.min : Math.max(current, req.min),
		);
	}

	const perRequirement: readonly RequirementChance[] = [...strictest].map(
		([substat, min]) => ({
			substat,
			min,
			valueProbability: substatValueChance(substat, min),
		}),
	);

	const requiredCount = strictest.size;
	const presenceProbability =
		requiredCount > slots
			? 0
			: combinations(poolSize - requiredCount, slots - requiredCount) /
				combinations(poolSize, slots);

	const valueProbability = perRequirement.reduce(
		(product, req) => product * req.valueProbability,
		1,
	);

	return {
		probability: presenceProbability * valueProbability,
		presenceProbability,
		valueProbability,
		perRequirement,
	};
}
