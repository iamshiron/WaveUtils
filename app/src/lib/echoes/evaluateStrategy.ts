/**
 * Evaluate a {@link LevelUpStrategy} against a single generated echo, exactly as
 * a player would: reveal one substat at a time, and after each reveal consult
 * that slot's gate to decide whether to keep paying or discard.
 *
 * The `target` is never used to make a keep/discard decision — it is only graded
 * afterwards (`isPerfect`) against the *full* echo, so the caller can measure how
 * often the plan threw away an echo that would have been perfect.
 */

import {
	addResources,
	refund,
	STAGE_COSTS,
	subResources,
	ZERO_RESOURCES,
} from "./levelCosts";
import { type Echo, echoMeetsRequirements } from "./simulate";
import {
	type Gate,
	type LevelUpStrategy,
	type ResourceVector,
	STRATEGY_SLOTS,
} from "./strategy";
import type { SubstatId } from "./substats";

/** Evaluates a gate over the set of substat types revealed so far. */
export function evalGate(
	gate: Gate,
	revealed: ReadonlySet<SubstatId>,
): boolean {
	switch (gate.kind) {
		case "present":
			return revealed.has(gate.substat);
		case "and":
			return gate.conditions.every((child) => evalGate(child, revealed));
		case "or":
			return gate.conditions.some((child) => evalGate(child, revealed));
		case "not":
			return !evalGate(gate.condition, revealed);
		default: {
			const exhaustive: never = gate;
			return exhaustive;
		}
	}
}

/** Result of running one echo through a strategy. */
export interface EchoOutcome {
	/** True if the echo passed every gate (leveled all the way to completion). */
	readonly kept: boolean;
	/** 1-based slot the echo reached: the discard slot, or {@link STRATEGY_SLOTS} if kept. */
	readonly stageReached: number;
	/** Whether the FULL echo satisfies the target — the grading yardstick. */
	readonly isPerfect: boolean;
	/** Gross resources spent leveling to `stageReached`. */
	readonly spent: ResourceVector;
	/** Resources recovered by breaking the echo down — zero unless it was discarded. */
	readonly refunded: ResourceVector;
	/** Net resources actually consumed (`spent − refunded`). */
	readonly net: ResourceVector;
}

/**
 * Replays a strategy over a pre-rolled echo. The echo is generated in full up
 * front (so `isPerfect` always reflects the true finished echo); the gates only
 * ever see the slots revealed up to their point in the timeline.
 */
export function runEcho(strategy: LevelUpStrategy, echo: Echo): EchoOutcome {
	const slots = echo.substats;
	const stageCount = Math.min(STRATEGY_SLOTS, slots.length);
	const revealed = new Set<SubstatId>();

	let spent = ZERO_RESOURCES;
	let stageReached = 0;
	let kept = true;

	for (let stage = 0; stage < stageCount; stage++) {
		// Pay to reach this tuning level, which reveals the slot's substat.
		spent = addResources(spent, STAGE_COSTS[stage]);
		revealed.add(slots[stage].substat);
		stageReached = stage + 1;

		const gate = strategy.gates[stage];
		if (gate && !evalGate(gate, revealed)) {
			kept = false;
			break;
		}
	}

	const isPerfect = echoMeetsRequirements(echo, strategy.target);
	// Kept echoes are equipped and used; only discarded echoes are broken down.
	const refunded = kept ? ZERO_RESOURCES : refund(spent);
	const net = subResources(spent, refunded);

	return { kept, stageReached, isPerfect, spent, refunded, net };
}
