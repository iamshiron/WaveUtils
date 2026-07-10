/**
 * Compact, URL-safe encoding of a requirement list so the whole calculator
 * state fits in a single query token — enabling shareable permalinks without
 * any backend storage.
 *
 * Encoding is positional: each requirement becomes two base-36 characters —
 * the substat's index in {@link SUBSTATS} and the chosen value's index in that
 * substat's roll ladder. Both indices are single characters (≤ 35), so a
 * requirement is 2 chars and the token is `2 × requirementCount` chars long.
 *
 * The scheme relies on the order of the substat pool and roll ladders staying
 * stable; append new substats/values rather than reordering to keep old links
 * valid. Unrecognized or duplicate chunks are skipped on decode.
 */

import type { SubstatRequirement } from "./rollChance";
import { ECHO_SUBSTAT_SLOTS, type SubstatId, SUBSTATS } from "./substats";

const RADIX = 36;
const EPSILON = 1e-9;

/** Encodes requirements into a compact token (empty string when there are none). */
export function encodeRequirements(
	requirements: readonly SubstatRequirement[],
): string {
	return requirements
		.map((requirement) => {
			const substatIndex = SUBSTATS.findIndex(
				(substat) => substat.id === requirement.substat,
			);
			if (substatIndex < 0) {
				return "";
			}
			const valueIndex = SUBSTATS[substatIndex].rolls.findIndex(
				(roll) => Math.abs(roll.value - requirement.min) < EPSILON,
			);
			if (valueIndex < 0) {
				return "";
			}
			return substatIndex.toString(RADIX) + valueIndex.toString(RADIX);
		})
		.join("");
}

/** Decodes a token back into requirements, ignoring invalid or duplicate chunks. */
export function decodeRequirements(
	token: string | undefined,
): SubstatRequirement[] {
	if (!token) {
		return [];
	}
	const seen = new Set<SubstatId>();
	const requirements: SubstatRequirement[] = [];
	for (let i = 0; i + 1 < token.length; i += 2) {
		const substatIndex = Number.parseInt(token[i], RADIX);
		const valueIndex = Number.parseInt(token[i + 1], RADIX);
		if (Number.isNaN(substatIndex) || Number.isNaN(valueIndex)) {
			continue;
		}
		const definition = SUBSTATS[substatIndex];
		const roll = definition?.rolls[valueIndex];
		if (!definition || !roll || seen.has(definition.id)) {
			continue;
		}
		seen.add(definition.id);
		requirements.push({ substat: definition.id, min: roll.value });
	}
	return requirements.slice(0, ECHO_SUBSTAT_SLOTS);
}
