import { Button } from "@shiron/ui/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@shiron/ui/components/ui/select";
import {
	ECHO_SUBSTAT_SLOTS,
	getSubstat,
	SUBSTATS,
	type SubstatId,
	type SubstatRequirement,
} from "@/lib/echoes";

interface DesiredStatsProps {
	readonly target: readonly SubstatRequirement[];
	readonly onChange: (target: readonly SubstatRequirement[]) => void;
}

function formatValue(id: SubstatId, value: number): string {
	return getSubstat(id).isPercent ? `${value}%` : `${value}`;
}

/**
 * Editor for the "perfect echo" wishlist (≤5 substats + min values). This list
 * is a grading yardstick only — it never influences the keep/discard gates.
 */
export function DesiredStats({ target, onChange }: DesiredStatsProps) {
	const used = new Set(target.map((row) => row.substat));
	const nextAvailable = SUBSTATS.find((substat) => !used.has(substat.id));
	const canAdd =
		target.length < ECHO_SUBSTAT_SLOTS && nextAvailable !== undefined;

	function addRow() {
		if (nextAvailable) {
			onChange([
				...target,
				{ substat: nextAvailable.id, min: nextAvailable.range.min },
			]);
		}
	}

	function removeRow(index: number) {
		onChange(target.filter((_, i) => i !== index));
	}

	function changeSubstat(index: number, substat: SubstatId) {
		onChange(
			target.map((row, i) =>
				i === index ? { substat, min: getSubstat(substat).range.min } : row,
			),
		);
	}

	function changeMin(index: number, min: number) {
		onChange(target.map((row, i) => (i === index ? { ...row, min } : row)));
	}

	return (
		<div className="space-y-2">
			{target.length === 0 ? (
				<p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
					No desired stats yet — add the substats (and minimum rolls) that make
					an echo “perfect”.
				</p>
			) : (
				target.map((row, index) => {
					const definition = getSubstat(row.substat);
					const disabledFor = new Set(
						target.filter((_, i) => i !== index).map((other) => other.substat),
					);
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
								<SelectTrigger className="h-8 min-w-28">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{definition.rolls.map((roll) => (
										<SelectItem key={roll.value} value={String(roll.value)}>
											{formatValue(definition.id, roll.value)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

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
			<Button variant="outline" size="sm" onClick={addRow} disabled={!canAdd}>
				+ Add desired stat
			</Button>
		</div>
	);
}
