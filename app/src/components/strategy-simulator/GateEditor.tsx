import { Badge } from "@shiron/ui/components/ui/badge";
import { Button } from "@shiron/ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@shiron/ui/components/ui/dropdown-menu";
import { type Gate, getSubstat, SUBSTATS, type SubstatId } from "@/lib/echoes";
import { gateToGroups, groupsToGate, type OrGroup } from "./gateGroups";

interface GateEditorProps {
	readonly slot: number;
	readonly gate: Gate | null;
	readonly onChange: (gate: Gate | null) => void;
}

/** A "+ add" button that opens a dropdown of substats to pick from. */
function AddStatMenu({
	label,
	options,
	onPick,
	variant = "ghost",
}: {
	label: string;
	options: readonly { readonly id: SubstatId; readonly label: string }[];
	onPick: (stat: SubstatId) => void;
	variant?: "ghost" | "outline";
}) {
	if (options.length === 0) {
		return null;
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant={variant}
					size="sm"
					className="h-7 gap-1 border-dashed px-2 text-xs text-muted-foreground"
				>
					{label}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
				{options.map((option) => (
					<DropdownMenuItem key={option.id} onSelect={() => onPick(option.id)}>
						{option.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * Edits one slot's keep-condition as an AND of OR-groups. Every mutation yields
 * a valid {@link Gate} (or `null`), so the URL stays the single source of truth.
 */
export function GateEditor({ slot, gate, onChange }: GateEditorProps) {
	const groups = gateToGroups(gate);
	const emit = (next: OrGroup[]) => onChange(groupsToGate(next));

	function updateGroup(index: number, group: OrGroup) {
		emit(groups.map((existing, i) => (i === index ? group : existing)));
	}

	function addGroup(stat: SubstatId) {
		emit([...groups, { negate: false, anyOf: [stat] }]);
	}

	function removeGroup(index: number) {
		emit(groups.filter((_, i) => i !== index));
	}

	function addStat(index: number, stat: SubstatId) {
		const group = groups[index];
		if (group.anyOf.includes(stat)) return;
		updateGroup(index, { ...group, anyOf: [...group.anyOf, stat] });
	}

	function removeStat(index: number, stat: SubstatId) {
		const group = groups[index];
		const anyOf = group.anyOf.filter((s) => s !== stat);
		if (anyOf.length === 0) {
			removeGroup(index);
		} else {
			updateGroup(index, { ...group, anyOf });
		}
	}

	return (
		<div className="rounded-lg border border-border p-3">
			<div className="mb-2 flex items-center justify-between">
				<span className="font-heading text-sm font-semibold">
					After slot {slot}
				</span>
				{groups.length === 0 && (
					<span className="text-xs text-muted-foreground">
						always keep (no gate)
					</span>
				)}
			</div>

			<div className="space-y-2">
				{groups.map((group, index) => {
					const available = SUBSTATS.filter((s) => !group.anyOf.includes(s.id));
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: groups have no stable id
						<div key={index} className="space-y-1">
							{index > 0 && (
								<div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
									and
								</div>
							)}
							<div className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/40 p-1.5">
								<Button
									variant={group.negate ? "destructive" : "outline"}
									size="sm"
									className="h-7 px-2 text-xs"
									onClick={() =>
										updateGroup(index, { ...group, negate: !group.negate })
									}
									title="Discard if present (blacklist)"
								>
									NOT
								</Button>

								{group.anyOf.map((stat, statIndex) => (
									<span key={stat} className="flex items-center gap-1">
										{statIndex > 0 && (
											<span className="text-[11px] text-muted-foreground">
												or
											</span>
										)}
										<Badge variant="secondary" className="gap-1 py-1">
											{getSubstat(stat).label}
											<button
												type="button"
												className="text-muted-foreground hover:text-foreground"
												onClick={() => removeStat(index, stat)}
												aria-label={`Remove ${getSubstat(stat).label}`}
											>
												×
											</button>
										</Badge>
									</span>
								))}

								<AddStatMenu
									label="+ or"
									options={available}
									onPick={(stat) => addStat(index, stat)}
								/>

								<Button
									variant="ghost"
									size="icon"
									className="ml-auto size-7 text-muted-foreground"
									onClick={() => removeGroup(index)}
									aria-label="Remove condition"
								>
									×
								</Button>
							</div>
						</div>
					);
				})}
			</div>

			<div className="mt-2">
				<AddStatMenu
					label="+ Require another stat (AND)"
					options={SUBSTATS}
					onPick={addGroup}
				/>
			</div>
		</div>
	);
}
