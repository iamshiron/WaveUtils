import { describe, expect, it } from "vitest";
import { evalGate, gateSubstats, runEcho } from "./evaluateStrategy";
import { cumulativeCostToStage, refund } from "./levelCosts";
import type { SubstatRequirement } from "./rollChance";
import type { Echo, RolledSubstat } from "./simulate";
import type { Gate, LevelUpStrategy } from "./strategy";
import type { SubstatId } from "./substats";

/** Build a rolled substat (rollIndex is irrelevant to strategy evaluation). */
function sub(substat: SubstatId, value: number): RolledSubstat {
	return { substat, value, rollIndex: 0 };
}

function echo(...substats: RolledSubstat[]): Echo {
	return { substats };
}

const present = (substat: SubstatId): Gate => ({ kind: "present", substat });
const and = (...conditions: Gate[]): Gate => ({ kind: "and", conditions });
const or = (...conditions: Gate[]): Gate => ({ kind: "or", conditions });

// The user's worked example:
//   slot1: Crit Rate OR Crit DMG
//   slot3: Crit Rate AND Crit DMG
//   slot5: Crit Rate AND Crit DMG AND (ATK% OR Resonance Liberation)
const TARGET: SubstatRequirement[] = [
	{ substat: "critRate", min: 8.1 },
	{ substat: "critDmg", min: 16.2 },
	{ substat: "atkPercent", min: 7.9 },
];
const STRATEGY: LevelUpStrategy = {
	version: 1,
	target: TARGET,
	gates: [
		or(present("critRate"), present("critDmg")),
		null,
		and(present("critRate"), present("critDmg")),
		null,
		and(
			present("critRate"),
			present("critDmg"),
			or(present("atkPercent"), present("resonanceLiberation")),
		),
	],
};

describe("evalGate", () => {
	const revealed = new Set<SubstatId>(["critRate", "atkPercent"]);

	it("evaluates present / and / or / not over the revealed set", () => {
		expect(evalGate(present("critRate"), revealed)).toBe(true);
		expect(evalGate(present("critDmg"), revealed)).toBe(false);
		expect(
			evalGate(or(present("critDmg"), present("atkPercent")), revealed),
		).toBe(true);
		expect(
			evalGate(and(present("critRate"), present("critDmg")), revealed),
		).toBe(false);
		expect(
			evalGate({ kind: "not", condition: present("critDmg") }, revealed),
		).toBe(true);
	});
});

describe("runEcho", () => {
	it("keeps an echo that satisfies every gate and grades it perfect", () => {
		const result = runEcho(
			STRATEGY,
			echo(
				sub("critRate", 8.1),
				sub("critDmg", 16.2),
				sub("atkPercent", 7.9),
				sub("hp", 470),
				sub("def", 60),
			),
		);
		expect(result.kept).toBe(true);
		expect(result.stageReached).toBe(5);
		expect(result.isPerfect).toBe(true);
		expect(result.spent).toEqual(cumulativeCostToStage(5));
		expect(result.refunded).toEqual({ echoExp: 0, tuners: 0, shellCredit: 0 });
		expect(result.net).toEqual(cumulativeCostToStage(5));
	});

	it("discards at slot 1 when neither crit appears, and refunds the spend", () => {
		const result = runEcho(
			STRATEGY,
			echo(
				sub("atkPercent", 7.9),
				sub("critRate", 8.1),
				sub("critDmg", 16.2),
				sub("hp", 470),
				sub("energyRegen", 10),
			),
		);
		expect(result.kept).toBe(false);
		expect(result.stageReached).toBe(1);
		// Cost accrual stops after the first tuning tier.
		expect(result.spent).toEqual(cumulativeCostToStage(1));
		expect(result.refunded).toEqual(refund(cumulativeCostToStage(1)));
	});

	it("discards at slot 3 when the second crit is missing", () => {
		const result = runEcho(
			STRATEGY,
			echo(
				sub("critRate", 8.1),
				sub("hp", 470),
				sub("def", 60),
				sub("atkPercent", 7.9),
				sub("critDmg", 16.2),
			),
		);
		expect(result.kept).toBe(false);
		expect(result.stageReached).toBe(3);
		expect(result.spent).toEqual(cumulativeCostToStage(3));
	});

	it("flags perfect-but-discarded: culled early yet the full echo meets the target", () => {
		// gate0 requires a crit at slot 1; this echo reveals atkPercent first and is
		// discarded — but its FULL roll has every target stat, so isPerfect is true.
		const result = runEcho(
			STRATEGY,
			echo(
				sub("atkPercent", 7.9),
				sub("critRate", 8.1),
				sub("critDmg", 16.2),
				sub("hp", 470),
				sub("def", 60),
			),
		);
		expect(result.kept).toBe(false);
		expect(result.isPerfect).toBe(true); // → counts toward perfectButDiscarded
	});

	it("flags imperfect keeps: passes every gate but a target value falls short", () => {
		// atkPercent 6.4 < required 7.9 → not perfect, yet all gates pass.
		const result = runEcho(
			STRATEGY,
			echo(
				sub("critRate", 8.1),
				sub("critDmg", 16.2),
				sub("atkPercent", 6.4),
				sub("hp", 470),
				sub("def", 60),
			),
		);
		expect(result.kept).toBe(true);
		expect(result.isPerfect).toBe(false); // → counts toward imperfectKeeps
	});

	it("never discards when the slot has no gate", () => {
		const noGates: LevelUpStrategy = {
			version: 1,
			target: [],
			gates: [null, null, null, null, null],
		};
		const result = runEcho(noGates, echo(sub("def", 40), sub("hp", 320)));
		expect(result.kept).toBe(true);
		expect(result.isPerfect).toBe(true); // empty target ⇒ everything is "perfect"
	});
});

describe("runEcho counterfactual (skipStage)", () => {
	// Discarded at slot 1 (atkPercent first, no crit), but the full roll is perfect.
	const perfectDiscard = echo(
		sub("atkPercent", 7.9),
		sub("critRate", 8.1),
		sub("critDmg", 16.2),
		sub("hp", 470),
		sub("def", 60),
	);

	it("bypasses only the skipped gate; downstream gates still apply", () => {
		// Skipping gate 0 lets it continue; gates 2 and 4 still pass here → kept.
		const relaxed = runEcho(STRATEGY, perfectDiscard, 0);
		expect(relaxed.kept).toBe(true);
		expect(relaxed.stageReached).toBe(5);
		expect(relaxed.net).toEqual(cumulativeCostToStage(5));
	});

	it("added net cost equals full net minus the discard's net", () => {
		const base = runEcho(STRATEGY, perfectDiscard);
		const relaxed = runEcho(STRATEGY, perfectDiscard, 0);
		const addedExp = relaxed.net.echoExp - base.net.echoExp;
		expect(addedExp).toBe(
			cumulativeCostToStage(5).echoExp - base.net.echoExp,
		);
		expect(addedExp).toBeGreaterThan(0);
	});

	it("skipping a gate the echo never reached changes nothing", () => {
		const base = runEcho(STRATEGY, perfectDiscard); // dies at slot 1
		const skipLater = runEcho(STRATEGY, perfectDiscard, 4);
		expect(skipLater).toEqual(base);
	});
});

describe("gateSubstats", () => {
	it("collects every present-leaf substat across the tree", () => {
		const gate = and(
			present("critRate"),
			or(present("critDmg"), present("atkPercent")),
			{ kind: "not", condition: present("hp") },
		);
		expect(gateSubstats(gate)).toEqual(
			new Set<SubstatId>(["critRate", "critDmg", "atkPercent", "hp"]),
		);
	});
});
