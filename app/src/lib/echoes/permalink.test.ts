import { describe, expect, it } from "vitest";
import { decodeRequirements, encodeRequirements } from "./permalink";
import type { SubstatRequirement } from "./rollChance";
import { ECHO_SUBSTAT_SLOTS, SUBSTATS } from "./substats";

const EXAMPLE: SubstatRequirement[] = [
	{ substat: "critDmg", min: 16.2 },
	{ substat: "critRate", min: 8.1 },
	{ substat: "atkPercent", min: 7.9 },
];

describe("encodeRequirements", () => {
	it("encodes an empty list as an empty token", () => {
		expect(encodeRequirements([])).toBe("");
	});

	it("uses exactly two characters per requirement", () => {
		expect(encodeRequirements(EXAMPLE)).toHaveLength(2 * EXAMPLE.length);
	});

	it("produces only URL-safe base-36 characters", () => {
		expect(encodeRequirements(EXAMPLE)).toMatch(/^[0-9a-z]*$/);
	});

	it("skips a requirement whose value is not a real roll", () => {
		// 16.25 is not a Crit DMG roll value.
		expect(encodeRequirements([{ substat: "critDmg", min: 16.25 }])).toBe("");
	});
});

describe("decodeRequirements", () => {
	it("returns [] for undefined or empty input", () => {
		expect(decodeRequirements(undefined)).toEqual([]);
		expect(decodeRequirements("")).toEqual([]);
	});

	it("ignores unparseable characters", () => {
		expect(decodeRequirements("@!")).toEqual([]);
		expect(decodeRequirements("**")).toEqual([]);
	});

	it("ignores out-of-range substat or value indices", () => {
		expect(decodeRequirements("z0")).toEqual([]); // substat index 35 doesn't exist
		expect(decodeRequirements("08")).toEqual([]); // value index 8 doesn't exist (0-7)
	});

	it("ignores a dangling half-chunk", () => {
		const token = encodeRequirements([{ substat: "critDmg", min: 16.2 }]);
		expect(decodeRequirements(`${token}5`)).toEqual([
			{ substat: "critDmg", min: 16.2 },
		]);
	});

	it("deduplicates repeated substats, keeping the first", () => {
		const token = encodeRequirements([{ substat: "critRate", min: 6.3 }]);
		expect(decodeRequirements(token + token)).toHaveLength(1);
	});

	it("caps the result at the slot limit", () => {
		const many = SUBSTATS.slice(0, ECHO_SUBSTAT_SLOTS + 2).map((substat) => ({
			substat: substat.id,
			min: substat.range.min,
		}));
		expect(decodeRequirements(encodeRequirements(many))).toHaveLength(
			ECHO_SUBSTAT_SLOTS,
		);
	});
});

describe("round-trip integrity", () => {
	it("restores the example exactly", () => {
		expect(decodeRequirements(encodeRequirements(EXAMPLE))).toEqual(EXAMPLE);
	});

	it("preserves requirement order", () => {
		const reversed = [...EXAMPLE].reverse();
		expect(decodeRequirements(encodeRequirements(reversed))).toEqual(reversed);
	});

	it("round-trips every substat at every possible roll value", () => {
		for (const substat of SUBSTATS) {
			for (const roll of substat.rolls) {
				const requirement: SubstatRequirement[] = [
					{ substat: substat.id, min: roll.value },
				];
				expect(decodeRequirements(encodeRequirements(requirement))).toEqual(
					requirement,
				);
			}
		}
	});
});
