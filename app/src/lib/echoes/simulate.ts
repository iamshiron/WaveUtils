/**
 * Monte-Carlo simulation of echo generation.
 *
 * Mirrors the in-game roll: `slots` distinct substats are drawn uniformly
 * without replacement from the pool, then each one's value is rolled from its
 * weighted distribution. The main stat is assumed already fixed and does not
 * influence substats, so it is not modeled here.
 */

import type { SubstatRequirement } from "./rollChance";
import {
	ECHO_SUBSTAT_SLOTS,
	type SubstatDefinition,
	type SubstatId,
	SUBSTATS,
} from "./substats";

/** A rolled substat instance on a generated echo. */
export interface RolledSubstat {
	readonly substat: SubstatId;
	readonly value: number;
	/** Index of the chosen value within the substat's roll ladder (0 = lowest). */
	readonly rollIndex: number;
}

/** A generated echo: an ordered set of distinct rolled substats. */
export interface Echo {
	readonly substats: readonly RolledSubstat[];
}

/** A source of uniform random numbers in [0, 1). Defaults to `Math.random`. */
export type RandomSource = () => number;

export interface RollEchoOptions {
	/** Number of substat slots to roll. Defaults to 5. */
	readonly slots?: number;
	/** Random source, for deterministic/seeded simulation. Defaults to `Math.random`. */
	readonly rng?: RandomSource;
}

/** Rolls one value for `definition` according to its weighted distribution. */
function rollValue(
	definition: SubstatDefinition,
	rng: RandomSource,
): RolledSubstat {
	const target = rng();
	let cumulative = 0;
	for (let index = 0; index < definition.rolls.length; index++) {
		cumulative += definition.rolls[index].weight;
		if (target < cumulative) {
			return {
				substat: definition.id,
				value: definition.rolls[index].value,
				rollIndex: index,
			};
		}
	}
	const last = definition.rolls.length - 1;
	return {
		substat: definition.id,
		value: definition.rolls[last].value,
		rollIndex: last,
	};
}

/** Simulates rolling a single random echo. */
export function rollEcho(options: RollEchoOptions = {}): Echo {
	const slots = options.slots ?? ECHO_SUBSTAT_SLOTS;
	const rng = options.rng ?? Math.random;

	const pool = SUBSTATS.slice();
	const count = Math.min(slots, pool.length);
	const substats: RolledSubstat[] = [];
	// Partial Fisher-Yates: each step draws one remaining substat uniformly.
	for (let i = 0; i < count; i++) {
		const j = i + Math.floor(rng() * (pool.length - i));
		const chosen = pool[j];
		pool[j] = pool[i];
		pool[i] = chosen;
		substats.push(rollValue(chosen, rng));
	}
	return { substats };
}

/** Whether an echo satisfies every requirement (unspecified substats are "don't care"). */
export function echoMeetsRequirements(
	echo: Echo,
	requirements: readonly SubstatRequirement[],
): boolean {
	return requirements.every((req) =>
		echo.substats.some(
			(rolled) =>
				rolled.substat === req.substat && rolled.value >= req.min - 1e-9,
		),
	);
}

/**
 * Estimates the roll chance empirically by simulating many echoes. Handy for
 * cross-checking {@link calculateRollChance}.
 */
export function estimateRollChance(
	requirements: readonly SubstatRequirement[],
	options: RollEchoOptions & { readonly samples?: number } = {},
): number {
	const samples = options.samples ?? 100_000;
	let hits = 0;
	for (let i = 0; i < samples; i++) {
		if (echoMeetsRequirements(rollEcho(options), requirements)) {
			hits++;
		}
	}
	return hits / samples;
}
