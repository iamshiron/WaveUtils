import { describe, expect, it } from "vitest";
import { runEcho } from "./evaluateStrategy";
import { cumulativeCostToStage, ECHO_MAX_STAGE, refund } from "./levelCosts";
import { accumulate, finalize, mergePartials, simulate } from "./monteCarlo";
import { mulberry32 } from "./prng";
import { calculateRollChance, type SubstatRequirement } from "./rollChance";
import { rollEcho } from "./simulate";
import type { LevelUpStrategy } from "./strategy";

function neverDiscard(target: SubstatRequirement[]): LevelUpStrategy {
	return { version: 1, target, gates: [null, null, null, null, null] };
}

describe("simulate", () => {
	it("is deterministic for a fixed seed", () => {
		const strategy = neverDiscard([{ substat: "critRate", min: 6.3 }]);
		expect(simulate(strategy, 5000, 42)).toEqual(simulate(strategy, 5000, 42));
	});

	it("keeps every echo when there are no gates", () => {
		const result = simulate(neverDiscard([]), 3000, 7);
		expect(result.kept).toBe(3000);
		expect(result.discarded).toBe(0);
		expect(result.keptRate).toBe(1);
	});

	it("matches the analytic roll chance for a never-discard strategy", () => {
		// Presence of Crit Rate (lowest value) — a high, stable probability (~5/13).
		const target: SubstatRequirement[] = [{ substat: "critRate", min: 6.3 }];
		const analytic = calculateRollChance(target).probability;
		const result = simulate(neverDiscard(target), 60000, 123);
		// With no gates, every echo is leveled fully, so the baseline perfect rate
		// is exactly the roll chance of the target.
		expect(result.baselinePerfectRate).toBeCloseTo(analytic, 2);
		expect(result.keptRate).toBe(1);
		expect(result.perfectKeeps / result.samples).toBeCloseTo(analytic, 2);
	});

	it("counts discards by stage and never exceeds the sample count", () => {
		const strategy: LevelUpStrategy = {
			version: 1,
			target: [{ substat: "critDmg", min: 12.6 }],
			gates: [{ kind: "present", substat: "critDmg" }, null, null, null, null],
		};
		const result = simulate(strategy, 5000, 3);
		const totalDiscards = result.discardsByStage.reduce((a, b) => a + b, 0);
		expect(totalDiscards).toBe(result.discarded);
		expect(result.kept + result.discarded).toBe(result.samples);
		// gate on slot 1 only → all discards happen at slot 1.
		expect(result.discardsByStage[0]).toBe(result.discarded);
	});
});

describe("mergePartials", () => {
	it("merging split runs equals accumulating the concatenation of the same seeded streams", () => {
		const strategy = neverDiscard([{ substat: "critRate", min: 8.1 }]);
		// Two independent seeded streams.
		const a = accumulate(strategy, 2000, mulberry32(1));
		const b = accumulate(strategy, 3000, mulberry32(2));
		const merged = finalize(mergePartials([a, b]), strategy);

		// Reproduce the same two streams and merge again → identical.
		const a2 = accumulate(strategy, 2000, mulberry32(1));
		const b2 = accumulate(strategy, 3000, mulberry32(2));
		expect(finalize(mergePartials([a2, b2]), strategy)).toEqual(merged);

		expect(merged.samples).toBe(5000);
		expect(merged.kept).toBe(a.kept + b.kept);
	});
});

describe("confusion matrix", () => {
	it("partitions every sample into exactly one of the four cells", () => {
		const strategy: LevelUpStrategy = {
			version: 1,
			target: [
				{ substat: "critRate", min: 8.1 },
				{ substat: "critDmg", min: 16.2 },
			],
			gates: [
				{
					kind: "or",
					conditions: [
						{ kind: "present", substat: "critRate" },
						{ kind: "present", substat: "critDmg" },
					],
				},
				null,
				null,
				null,
				null,
			],
		};
		const r = simulate(strategy, 10000, 99);
		expect(
			r.perfectKeeps +
				r.imperfectKeeps +
				r.perfectButDiscarded +
				r.correctDiscards,
		).toBe(r.samples);
		expect(r.perfectKeeps + r.imperfectKeeps).toBe(r.kept);
		expect(r.perfectButDiscarded + r.correctDiscards).toBe(r.discarded);
	});
});

describe("per-slot diagnostics", () => {
	// Gate on slot 1 only, so every discard happens at slot 1 and relaxing gate 0
	// (no downstream gates) turns each discard into a keep — fully deterministic.
	const slot1Only: LevelUpStrategy = {
		version: 1,
		target: [
			{ substat: "critRate", min: 8.1 },
			{ substat: "critDmg", min: 16.2 },
		],
		gates: [{ kind: "present", substat: "critRate" }, null, null, null, null],
	};

	it("reachedByStage starts at samples and is non-increasing", () => {
		const r = simulate(slot1Only, 8000, 11);
		expect(r.reachedByStage[0]).toBe(r.samples);
		for (let i = 1; i < r.reachedByStage.length; i++) {
			expect(r.reachedByStage[i]).toBeLessThanOrEqual(r.reachedByStage[i - 1]);
		}
	});

	it("perfectDiscardsByStage sums to perfectButDiscarded and is bounded by discards", () => {
		const r = simulate(slot1Only, 8000, 11);
		const totalWinnersKilled = r.perfectDiscardsByStage.reduce(
			(a, b) => a + b,
			0,
		);
		expect(totalWinnersKilled).toBe(r.perfectButDiscarded);
		r.perfectDiscardsByStage.forEach((killed, i) => {
			expect(killed).toBeLessThanOrEqual(r.discardsByStage[i]);
		});
	});

	it("wastedByStage is the discard count times the fixed per-stage net loss", () => {
		const r = simulate(slot1Only, 8000, 11);
		const spent1 = cumulativeCostToStage(1);
		const net1 = spent1.echoExp - refund(spent1).echoExp;
		expect(r.wastedByStage[0].echoExp).toBeCloseTo(
			r.discardsByStage[0] * net1,
			6,
		);
	});
});

describe("gate sensitivity", () => {
	const slot1Only: LevelUpStrategy = {
		version: 1,
		target: [
			{ substat: "critRate", min: 8.1 },
			{ substat: "critDmg", min: 16.2 },
		],
		gates: [{ kind: "present", substat: "critRate" }, null, null, null, null],
	};

	it("relaxing the only gate recovers exactly the winners it killed", () => {
		const r = simulate(slot1Only, 8000, 11);
		// No downstream gates ⇒ every slot-1 discard becomes a keep when relaxed.
		expect(r.gateSensitivity[0].hasGate).toBe(true);
		expect(r.gateSensitivity[0].newKeeps).toBe(r.discardsByStage[0]);
		expect(r.gateSensitivity[0].recoversPerfect).toBe(
			r.perfectDiscardsByStage[0],
		);
		expect(r.gateSensitivity[0].addsImperfect).toBe(
			r.gateSensitivity[0].newKeeps - r.gateSensitivity[0].recoversPerfect,
		);
		if (r.gateSensitivity[0].newKeeps > 0) {
			expect(r.gateSensitivity[0].addedNet.echoExp).toBeGreaterThan(0);
		}
	});

	it("null-gate slots have no gate and zero relax impact", () => {
		const r = simulate(slot1Only, 8000, 11);
		for (let i = 1; i < r.gateSensitivity.length; i++) {
			expect(r.gateSensitivity[i].hasGate).toBe(false);
			expect(r.gateSensitivity[i].newKeeps).toBe(0);
			expect(r.gateSensitivity[i].recoversPerfect).toBe(0);
			expect(r.gateSensitivity[i].addedNet).toEqual({
				echoExp: 0,
				tuners: 0,
				shellCredit: 0,
			});
		}
	});

	it("recovered winners never exceed the winners a gate discarded", () => {
		// With downstream gates, some recovered echoes die later, so recovered ≤ killed.
		const multiGate: LevelUpStrategy = {
			version: 1,
			target: [
				{ substat: "critRate", min: 8.1 },
				{ substat: "critDmg", min: 16.2 },
			],
			gates: [
				{ kind: "present", substat: "critRate" },
				null,
				{ kind: "present", substat: "critDmg" },
				null,
				null,
			],
		};
		const r = simulate(multiGate, 8000, 21);
		r.gateSensitivity.forEach((s, i) => {
			expect(s.recoversPerfect).toBeLessThanOrEqual(
				r.perfectDiscardsByStage[i],
			);
		});
	});
});

describe("cross-check against the single-echo evaluator", () => {
	it("gross cost equals summing runEcho over the same seeded stream", () => {
		const strategy: LevelUpStrategy = {
			version: 1,
			target: [{ substat: "critRate", min: 8.1 }],
			gates: [{ kind: "present", substat: "critRate" }, null, null, null, null],
		};
		const samples = 2000;
		const result = finalize(
			accumulate(strategy, samples, mulberry32(5)),
			strategy,
		);

		// Re-derive gross EXP with an identical stream via the public primitives.
		const rng = mulberry32(5);
		let grossExp = 0;
		for (let i = 0; i < samples; i++) {
			grossExp += runEcho(strategy, rollEcho({ rng })).spent.echoExp;
		}
		expect(result.grossCost.echoExp).toBe(grossExp);
	});

	it("a full-cost echo is 142,600 EXP (sanity on the cost model)", () => {
		expect(cumulativeCostToStage(ECHO_MAX_STAGE).echoExp).toBe(142600);
	});
});
