import { describe, expect, it } from "vitest";
import { calculateRollChance, substatValueChance } from "./rollChance";
import { SUBSTATS } from "./substats";

describe("substatValueChance", () => {
	it("returns 1 when the threshold is at or below the lowest roll", () => {
		expect(substatValueChance("critDmg", 12.6)).toBeCloseTo(1, 10);
		expect(substatValueChance("critDmg", 0)).toBeCloseTo(1, 10);
	});

	it("returns 0 when the threshold is above the highest roll", () => {
		expect(substatValueChance("critDmg", 21.001)).toBe(0);
		expect(substatValueChance("critDmg", 999)).toBe(0);
	});

	it("sums the weights at or above the threshold (weighted, not uniform)", () => {
		// Crit ladder weights: 3×23.33%, 3×8%, 2×3%. ≥16.2 keeps the last five.
		expect(substatValueChance("critDmg", 16.2)).toBeCloseTo(0.3, 6);
		// Only the top value → 3%.
		expect(substatValueChance("critDmg", 21)).toBeCloseTo(0.03, 6);
	});

	it("is inclusive at an exact roll value despite float representation", () => {
		// 8.1 is exactly a Crit Rate roll; it must be counted.
		expect(substatValueChance("critRate", 8.1)).toBeCloseTo(0.3, 6);
	});

	it("diverges from a naive uniform count", () => {
		// ATK% ≥ 7.9 keeps 6 of 8 values, but weighted it is ~85.4%, not 75%.
		const weighted = substatValueChance("atkPercent", 7.9);
		expect(weighted).toBeCloseTo(0.8544, 3);
		expect(weighted).not.toBeCloseTo(6 / 8, 2);
	});

	it("is monotonically non-increasing as the threshold rises", () => {
		for (const substat of SUBSTATS) {
			let previous = Number.POSITIVE_INFINITY;
			for (const roll of substat.rolls) {
				const chance = substatValueChance(substat.id, roll.value);
				expect(chance).toBeLessThanOrEqual(previous + 1e-12);
				previous = chance;
			}
		}
	});
});

describe("calculateRollChance", () => {
	it("treats no requirements as a guaranteed match", () => {
		const result = calculateRollChance([]);
		expect(result.probability).toBeCloseTo(1, 10);
		expect(result.presenceProbability).toBeCloseTo(1, 10);
		expect(result.valueProbability).toBeCloseTo(1, 10);
		expect(result.perRequirement).toHaveLength(0);
	});

	it("uses C(pool-k, slots-k)/C(pool, slots) for presence", () => {
		// One substat, don't-care value → presence 5/13.
		const one = calculateRollChance([{ substat: "critRate", min: 6.3 }]);
		expect(one.presenceProbability).toBeCloseTo(5 / 13, 10);
		expect(one.valueProbability).toBeCloseTo(1, 10);
		expect(one.probability).toBeCloseTo(5 / 13, 10);

		// Five distinct substats → presence C(8,0)/C(13,5) = 1/1287.
		const five = calculateRollChance([
			{ substat: "critRate", min: 6.3 },
			{ substat: "critDmg", min: 12.6 },
			{ substat: "atkPercent", min: 6.4 },
			{ substat: "hpPercent", min: 6.4 },
			{ substat: "defPercent", min: 8.1 },
		]);
		expect(five.presenceProbability).toBeCloseTo(1 / 1287, 12);
	});

	it("computes the worked example (~1 in 372)", () => {
		const result = calculateRollChance([
			{ substat: "critDmg", min: 16.2 },
			{ substat: "critRate", min: 8.1 },
			{ substat: "atkPercent", min: 7.9 },
		]);
		expect(result.presenceProbability).toBeCloseTo(45 / 1287, 10);
		// Overall = presence × ∏ value chances; assert the invariant and magnitude.
		const expectedValue =
			substatValueChance("critDmg", 16.2) *
			substatValueChance("critRate", 8.1) *
			substatValueChance("atkPercent", 7.9);
		expect(result.valueProbability).toBeCloseTo(expectedValue, 12);
		expect(result.probability).toBeCloseTo(
			result.presenceProbability * result.valueProbability,
			12,
		);
		expect(1 / result.probability).toBeCloseTo(372, 0);
	});

	it("returns 0 when more substats are required than there are slots", () => {
		const result = calculateRollChance(
			[
				{ substat: "critDmg", min: 12.6 },
				{ substat: "critRate", min: 6.3 },
				{ substat: "atkPercent", min: 6.4 },
			],
			{ slots: 2 },
		);
		expect(result.presenceProbability).toBe(0);
		expect(result.probability).toBe(0);
	});

	it("merges duplicate substats to the strictest threshold", () => {
		const result = calculateRollChance([
			{ substat: "critDmg", min: 12.6 },
			{ substat: "critDmg", min: 16.2 },
		]);
		expect(result.perRequirement).toHaveLength(1);
		expect(result.perRequirement[0]).toMatchObject({
			substat: "critDmg",
			min: 16.2,
		});
		// Only one substat required → presence 5/13, value chance(≥16.2) = 0.3.
		expect(result.presenceProbability).toBeCloseTo(5 / 13, 10);
		expect(result.valueProbability).toBeCloseTo(0.3, 6);
	});

	it("honors custom pool size and slot count", () => {
		const result = calculateRollChance([{ substat: "critDmg", min: 12.6 }], {
			slots: 4,
			poolSize: 10,
		});
		// presence = C(9,3)/C(10,4) = 84/210 = 0.4
		expect(result.presenceProbability).toBeCloseTo(0.4, 10);
	});

	it("caps an impossible value threshold at zero overall", () => {
		const result = calculateRollChance([{ substat: "critDmg", min: 999 }]);
		expect(result.valueProbability).toBe(0);
		expect(result.probability).toBe(0);
	});
});
