/**
 * URL codec for a {@link LevelUpStrategy}, spread across independent search
 * params for easy (de)serialization: `target` plus `gate0`..`gate4`.
 *
 *   • `target` reuses the Roll Calculator codec ({@link encodeRequirements}).
 *   • each gate is emitted in prefix (Polish) notation — one opcode char per
 *     node: `p`=present (+ base-36 substat index), `!`=not, `&`=and / `|`=or
 *     (+ a base-36 child count). An empty/`null` gate encodes to "" and is
 *     omitted from the URL.
 *
 * Like {@link decodeRequirements}, decoding degrades gracefully: an unparseable
 * gate becomes `null` (no gate) rather than throwing. Stability relies on the
 * substat pool staying append-only (see `permalink.ts`).
 */

import { decodeRequirements, encodeRequirements } from "./permalink";
import { type Gate, type LevelUpStrategy, STRATEGY_SLOTS } from "./strategy";
import { SUBSTATS } from "./substats";

const RADIX = 36;

/** Search-param shape carried in the URL (all optional; absent = empty). */
export type StrategySearch = {
	target?: string;
	gate0?: string;
	gate1?: string;
	gate2?: string;
	gate3?: string;
	gate4?: string;
};

/** Encodes a single gate to prefix notation ("" for `null` or an invalid gate). */
export function encodeGate(gate: Gate | null): string {
	if (!gate) {
		return "";
	}
	switch (gate.kind) {
		case "present": {
			const index = SUBSTATS.findIndex((s) => s.id === gate.substat);
			return index < 0 ? "" : `p${index.toString(RADIX)}`;
		}
		case "not": {
			const child = encodeGate(gate.condition);
			return child ? `!${child}` : "";
		}
		case "and":
		case "or": {
			const parts = gate.conditions.map(encodeGate);
			if (parts.some((part) => part === "")) {
				return "";
			}
			const op = gate.kind === "and" ? "&" : "|";
			return `${op}${gate.conditions.length.toString(RADIX)}${parts.join("")}`;
		}
		default: {
			const exhaustive: never = gate;
			return exhaustive;
		}
	}
}

/** Recursive-descent parser cursor. */
interface Cursor {
	readonly token: string;
	pos: number;
}

function parseGate(cursor: Cursor): Gate | null {
	if (cursor.pos >= cursor.token.length) {
		return null;
	}
	const op = cursor.token[cursor.pos++];
	switch (op) {
		case "p": {
			const index = Number.parseInt(cursor.token[cursor.pos++], RADIX);
			const definition = SUBSTATS[index];
			return definition ? { kind: "present", substat: definition.id } : null;
		}
		case "!": {
			const child = parseGate(cursor);
			return child ? { kind: "not", condition: child } : null;
		}
		case "&":
		case "|": {
			const count = Number.parseInt(cursor.token[cursor.pos++], RADIX);
			if (Number.isNaN(count)) {
				return null;
			}
			const conditions: Gate[] = [];
			for (let i = 0; i < count; i++) {
				const child = parseGate(cursor);
				if (!child) {
					return null;
				}
				conditions.push(child);
			}
			return op === "&"
				? { kind: "and", conditions }
				: { kind: "or", conditions };
		}
		default:
			return null;
	}
}

/** Decodes a gate token, returning `null` on empty or malformed input. */
export function decodeGate(token: string | undefined): Gate | null {
	if (!token) {
		return null;
	}
	return parseGate({ token, pos: 0 });
}

/** Encodes a strategy into URL search params, omitting empty ones. */
export function encodeStrategy(strategy: LevelUpStrategy): StrategySearch {
	const search: StrategySearch = {};
	const target = encodeRequirements(strategy.target);
	if (target) {
		search.target = target;
	}
	for (let i = 0; i < STRATEGY_SLOTS; i++) {
		const token = encodeGate(strategy.gates[i] ?? null);
		if (token) {
			search[`gate${i}` as keyof StrategySearch] = token;
		}
	}
	return search;
}

/** Decodes URL search params back into a strategy. */
export function decodeStrategy(search: StrategySearch): LevelUpStrategy {
	const target = decodeRequirements(search.target);
	const gates = Array.from({ length: STRATEGY_SLOTS }, (_, i) =>
		decodeGate(search[`gate${i}` as keyof StrategySearch]),
	);
	return { version: 1, target, gates };
}
