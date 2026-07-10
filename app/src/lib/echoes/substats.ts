/**
 * Wuthering Waves echo substat data — the single source of truth.
 *
 * Values and weights are the officially disclosed roll distributions
 * (Kuro Games KR product-info page), transcribed from the project notes.
 *
 * ── Updating when the game data changes ────────────────────────────────
 *   • New value ladder / weights ....... edit the `*_VALUES` / `*_WEIGHTS`
 *     constants or a substat's entry in `SUBSTAT_SOURCES` below.
 *   • Brand-new substat ................ add one row to `SUBSTAT_SOURCES`;
 *     the `SubstatId` union, the pool size and all lookups update on their
 *     own — no other file needs touching.
 *   • Different slot count ............. edit `ECHO_SUBSTAT_SLOTS`.
 * Weights need not sum to 100 — they are normalized to probabilities here.
 */

// --- Roll weight distributions (disclosed percentages) ---

const STANDARD_WEIGHTS = [
	6.7961, 7.767, 20.3883, 24.2718, 17.4757, 14.5631, 5.8252, 2.9126,
] as const;
const CRIT_WEIGHTS = [23.3333, 23.3333, 23.3333, 8, 8, 8, 3, 3] as const;
const FLAT_ATK_WEIGHTS = [6.7961, 52.4272, 37.8641, 2.9126] as const;
const FLAT_DEF_WEIGHTS = [14.5631, 44.6602, 32.0388, 8.7379] as const;

// --- Roll value ladders (ascending) ---

const PERCENT_VALUES = [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6] as const;
const DEF_PERCENT_VALUES = [8.1, 9.0, 10.0, 10.9, 11.8, 12.8, 13.8, 14.7] as const;
const ENERGY_REGEN_VALUES = [6.8, 7.6, 8.4, 9.2, 10, 10.8, 11.6, 12.4] as const;
const FLAT_HP_VALUES = [320, 360, 390, 430, 470, 510, 540, 580] as const;
const CRIT_RATE_VALUES = [6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5] as const;
const CRIT_DMG_VALUES = [12.6, 13.8, 15.0, 16.2, 17.4, 18.6, 19.8, 21.0] as const;
const FLAT_ATK_VALUES = [30, 40, 50, 60] as const;
const FLAT_DEF_VALUES = [40, 50, 60, 70] as const;

/**
 * Every substat in the pool. This array is the single editable table; all
 * types and lookups below are derived from it.
 */
const SUBSTAT_SOURCES = [
	{ id: "critRate", label: "Crit. Rate", isPercent: true, values: CRIT_RATE_VALUES, weights: CRIT_WEIGHTS },
	{ id: "critDmg", label: "Crit. DMG", isPercent: true, values: CRIT_DMG_VALUES, weights: CRIT_WEIGHTS },
	{ id: "atkPercent", label: "ATK%", isPercent: true, values: PERCENT_VALUES, weights: STANDARD_WEIGHTS },
	{ id: "hpPercent", label: "HP%", isPercent: true, values: PERCENT_VALUES, weights: STANDARD_WEIGHTS },
	{ id: "defPercent", label: "DEF%", isPercent: true, values: DEF_PERCENT_VALUES, weights: STANDARD_WEIGHTS },
	{ id: "energyRegen", label: "Energy Regen", isPercent: true, values: ENERGY_REGEN_VALUES, weights: STANDARD_WEIGHTS },
	{ id: "basicAttack", label: "Basic Attack DMG Bonus", isPercent: true, values: PERCENT_VALUES, weights: STANDARD_WEIGHTS },
	{ id: "heavyAttack", label: "Heavy Attack DMG Bonus", isPercent: true, values: PERCENT_VALUES, weights: STANDARD_WEIGHTS },
	{ id: "resonanceSkill", label: "Resonance Skill DMG Bonus", isPercent: true, values: PERCENT_VALUES, weights: STANDARD_WEIGHTS },
	{ id: "resonanceLiberation", label: "Resonance Liberation DMG Bonus", isPercent: true, values: PERCENT_VALUES, weights: STANDARD_WEIGHTS },
	{ id: "hp", label: "HP", isPercent: false, values: FLAT_HP_VALUES, weights: STANDARD_WEIGHTS },
	{ id: "atk", label: "ATK", isPercent: false, values: FLAT_ATK_VALUES, weights: FLAT_ATK_WEIGHTS },
	{ id: "def", label: "DEF", isPercent: false, values: FLAT_DEF_VALUES, weights: FLAT_DEF_WEIGHTS },
] as const;

/** Identifier for each substat, derived from the source table. */
export type SubstatId = (typeof SUBSTAT_SOURCES)[number]["id"];

/** A single possible roll value together with its probability. */
export interface SubstatRoll {
	/** Stat value. Percent substats use their percent number (e.g. 7.9 for 7.9%). */
	readonly value: number;
	/** Probability of rolling this exact value, normalized to [0, 1]. */
	readonly weight: number;
}

/** Inclusive min/max of a substat's possible roll values (useful for color coding). */
export interface SubstatRange {
	readonly min: number;
	readonly max: number;
}

/** Full definition of a substat: display metadata, roll distribution and value range. */
export interface SubstatDefinition {
	readonly id: SubstatId;
	readonly label: string;
	/** Whether the value is a percentage (affects formatting only). */
	readonly isPercent: boolean;
	/** All possible roll values, ascending, with normalized weights. */
	readonly rolls: readonly SubstatRoll[];
	/** Lowest and highest possible roll value. */
	readonly range: SubstatRange;
}

function defineSubstat(source: (typeof SUBSTAT_SOURCES)[number]): SubstatDefinition {
	const { values, weights } = source;
	if (values.length !== weights.length) {
		throw new Error(
			`Substat "${source.id}" mismatch: ${values.length} values vs ${weights.length} weights`,
		);
	}
	const total = weights.reduce((sum, weight) => sum + weight, 0);
	const rolls = values.map((value, index) => ({
		value,
		weight: weights[index] / total,
	}));
	return {
		id: source.id,
		label: source.label,
		isPercent: source.isPercent,
		rolls,
		range: { min: Math.min(...values), max: Math.max(...values) },
	};
}

/** All substats with their normalized roll distributions and value ranges. */
export const SUBSTATS: readonly SubstatDefinition[] = SUBSTAT_SOURCES.map(defineSubstat);

/** Number of substat slots on a fully-tuned 5★ echo. */
export const ECHO_SUBSTAT_SLOTS = 5;

/** Total number of distinct substats in the pool (derived, currently 13). */
export const SUBSTAT_POOL_SIZE = SUBSTATS.length;

const SUBSTAT_BY_ID = new Map<SubstatId, SubstatDefinition>(
	SUBSTATS.map((substat) => [substat.id, substat]),
);

/** Looks up a substat definition by id. Throws on an unknown id. */
export function getSubstat(id: SubstatId): SubstatDefinition {
	const definition = SUBSTAT_BY_ID.get(id);
	if (!definition) {
		throw new Error(`Unknown substat id: ${id}`);
	}
	return definition;
}

/**
 * Maps a rolled value to its position within the substat's value range, in [0, 1]
 * (0 = lowest possible roll, 1 = highest). Intended for color coding.
 */
export function normalizeRoll(id: SubstatId, value: number): number {
	const { min, max } = getSubstat(id).range;
	if (max === min) {
		return 1;
	}
	return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
