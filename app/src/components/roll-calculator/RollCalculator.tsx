import { Badge } from "@shiron/ui/components/ui/badge";
import { Button } from "@shiron/ui/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@shiron/ui/components/ui/select";
import { useMemo } from "react";
import {
	calculateRollChance,
	ECHO_SUBSTAT_SLOTS,
	getSubstat,
	SUBSTATS,
	type SubstatId,
	type SubstatRequirement,
	substatValueChance,
} from "@/lib/echoes";

interface RollCalculatorProps {
	/** Current requirements — the source of truth lives in the URL. */
	readonly requirements: readonly SubstatRequirement[];
	/** Called with the next requirement list whenever the user edits anything. */
	readonly onChange: (requirements: readonly SubstatRequirement[]) => void;
}

function formatPercent(probability: number): string {
	if (probability <= 0) {
		return "0%";
	}
	if (probability >= 1) {
		return "100%";
	}
	if (probability < 0.0001) {
		return `${(probability * 100).toFixed(5)}%`;
	}
	if (probability < 0.01) {
		return `${(probability * 100).toFixed(4)}%`;
	}
	return `${(probability * 100).toFixed(2)}%`;
}

function formatOdds(probability: number): string {
	if (probability <= 0) {
		return "impossible";
	}
	if (probability >= 1) {
		return "guaranteed";
	}
	return `1 in ${Math.round(1 / probability).toLocaleString()}`;
}

function formatValue(id: SubstatId, value: number): string {
	return getSubstat(id).isPercent ? `${value}%` : `${value}`;
}

export function RollCalculator({ requirements, onChange }: RollCalculatorProps) {
	const rows = requirements;

	const result = useMemo(() => calculateRollChance(rows), [rows]);

	const usedSubstats = new Set(rows.map((row) => row.substat));
	const nextAvailable = SUBSTATS.find((substat) => !usedSubstats.has(substat.id));
	const canAdd = rows.length < ECHO_SUBSTAT_SLOTS && nextAvailable !== undefined;

	function addRow() {
		if (!nextAvailable) {
			return;
		}
		onChange([
			...rows,
			{ substat: nextAvailable.id, min: nextAvailable.range.min },
		]);
	}

	function removeRow(index: number) {
		onChange(rows.filter((_, i) => i !== index));
	}

	function changeSubstat(index: number, substat: SubstatId) {
		const definition = getSubstat(substat);
		onChange(
			rows.map((row, i) =>
				i === index ? { substat, min: definition.range.min } : row,
			),
		);
	}

	function changeMin(index: number, min: number) {
		onChange(rows.map((row, i) => (i === index ? { ...row, min } : row)));
	}

	return (
		<div className="space-y-8">
			<section className="space-y-3">
				<h2 className="font-heading text-sm font-semibold text-muted-foreground">
					Requirements
				</h2>
				<div className="space-y-2">
					{rows.length === 0 ? (
						<p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
							No requirements — any echo qualifies. Add one to start.
						</p>
					) : (
						rows.map((row, index) => {
							const definition = getSubstat(row.substat);
							const disabledFor = new Set(
								rows
									.filter((_, i) => i !== index)
									.map((other) => other.substat),
							);
							const atLeastChance = substatValueChance(row.substat, row.min);

							return (
								<div
									key={row.substat}
									className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
								>
									<Select
										value={row.substat}
										onValueChange={(value) =>
											changeSubstat(index, value as SubstatId)
										}
									>
										<SelectTrigger className="h-8 min-w-56 flex-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{SUBSTATS.map((substat) => (
												<SelectItem
													key={substat.id}
													value={substat.id}
													disabled={disabledFor.has(substat.id)}
												>
													{substat.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<span className="px-0.5 text-sm text-muted-foreground">≥</span>

									<Select
										value={String(row.min)}
										onValueChange={(value) => changeMin(index, Number(value))}
									>
										<SelectTrigger className="h-8 min-w-32">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{definition.rolls.map((roll) => (
												<SelectItem key={roll.value} value={String(roll.value)}>
													<span className="flex w-full items-center justify-between gap-4">
														<span className="tabular-nums">
															{formatValue(definition.id, roll.value)}
														</span>
														<span className="text-[11px] tabular-nums text-muted-foreground">
															{(roll.weight * 100).toFixed(2)}%
														</span>
													</span>
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<Badge
										variant="secondary"
										className="tabular-nums"
										title="Chance a present roll of this substat meets the threshold"
									>
										≥ {formatPercent(atLeastChance)}
									</Badge>

									<Button
										variant="ghost"
										size="icon"
										className="ml-auto size-8 text-muted-foreground"
										onClick={() => removeRow(index)}
										aria-label={`Remove ${definition.label}`}
									>
										×
									</Button>
								</div>
								);
							})
						)}
				</div>
				<Button variant="outline" size="sm" onClick={addRow} disabled={!canAdd}>
					+ Add requirement
				</Button>
			</section>

			<section className="border-t border-border pt-6">
				{rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Add one or more requirements to see the chance of rolling a matching
						echo.
					</p>
				) : (
					<div className="flex flex-wrap items-end justify-between gap-6">
						<div>
							<div className="font-heading text-5xl font-bold tabular-nums text-primary">
								{formatPercent(result.probability)}
							</div>
							<div className="mt-1 text-sm text-muted-foreground">
								≈ {formatOdds(result.probability)} echoes
							</div>
						</div>
						<dl className="space-y-1 text-right text-xs text-muted-foreground">
							<div className="flex justify-between gap-6">
								<dt>All required substats present</dt>
								<dd className="tabular-nums text-foreground">
									{formatPercent(result.presenceProbability)}
								</dd>
							</div>
							<div className="flex justify-between gap-6">
								<dt>All values meet thresholds</dt>
								<dd className="tabular-nums text-foreground">
									{formatPercent(result.valueProbability)}
								</dd>
							</div>
							<div className="flex justify-between gap-6">
								<dt>Substats required</dt>
								<dd className="tabular-nums text-foreground">
									{rows.length} / {ECHO_SUBSTAT_SLOTS}
								</dd>
							</div>
						</dl>
					</div>
				)}
			</section>
		</div>
	);
}
