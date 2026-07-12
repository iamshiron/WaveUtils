import { Badge } from "@shiron/ui/components/ui/badge";
import { Card } from "@shiron/ui/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@shiron/ui/components/ui/tooltip";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Tooltip as RechartsTooltip,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import {
	calculateRollChance,
	gateSubstats,
	getSubstat,
	type LevelUpStrategy,
	type ResourceVector,
	type SimulationResult,
	type SubstatId,
} from "@/lib/echoes";

const FULL_ECHO_EXP = 142600;

function isFiniteVector(v: ResourceVector): boolean {
	return Number.isFinite(v.echoExp);
}

function round(n: number): string {
	return Math.round(n).toLocaleString();
}

function pct(fraction: number): string {
	return `${(fraction * 100).toFixed(1)}%`;
}

/** Compact Echo-EXP readout: 1.2M / 340k / 820. */
function compactExp(n: number): string {
	if (!Number.isFinite(n)) return "—";
	if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
	return String(Math.round(n));
}

/** Formats a desired-stat threshold, appending "%" for percent substats. */
function formatValue(substat: SubstatId, value: number): string {
	return getSubstat(substat).isPercent ? `${value}%` : String(value);
}

/** A label with a dotted underline that reveals an explanation on hover. */
function InfoTip({
	text,
	children,
}: {
	text: string;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">
					{children}
				</span>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs text-xs leading-relaxed">
				{text}
			</TooltipContent>
		</Tooltip>
	);
}

/** Compact "EXP · Tuners · Shell" resource readout. */
function Resources({ value }: { value: ResourceVector }) {
	if (!isFiniteVector(value)) {
		return <span className="text-muted-foreground">never</span>;
	}
	return (
		<span className="tabular-nums">
			{round(value.echoExp)}{" "}
			<span className="text-xs text-muted-foreground">EXP</span> ·{" "}
			{round(value.tuners)}{" "}
			<span className="text-xs text-muted-foreground">Tuners</span> ·{" "}
			{round(value.shellCredit)}{" "}
			<span className="text-xs text-muted-foreground">Shell</span>
		</span>
	);
}

function Stat({
	label,
	children,
	hint,
	info,
}: {
	label: string;
	children: React.ReactNode;
	hint?: string;
	info?: string;
}) {
	return (
		<div>
			<div className="text-xs text-muted-foreground">
				{info ? <InfoTip text={info}>{label}</InfoTip> : label}
			</div>
			<div className="mt-0.5 font-medium tabular-nums">{children}</div>
			{hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
		</div>
	);
}

/**
 * One confusion-matrix cell: a count and share, tinted as a heatmap. "Win" cells
 * (the diagonal) tint green, "mistake" cells (the off-diagonal) tint red, with
 * the intensity scaled by the cell's share of all echoes.
 */
function MatrixCell({
	value,
	total,
	caption,
	info,
	kind,
}: {
	value: number;
	total: number;
	caption: string;
	info: string;
	kind: "good" | "mistake";
}) {
	const share = total > 0 ? value / total : 0;
	// sqrt curve so small-but-notable shares still get a visible tint.
	const intensity = Math.min(1, Math.sqrt(share));
	const base = kind === "good" ? "var(--primary)" : "var(--destructive)";
	const backgroundColor = `color-mix(in oklch, ${base} ${Math.round(
		intensity * 35,
	)}%, var(--card))`;
	// More precision for small cells so they don't collapse to "0.0%".
	const shareText =
		total > 0 ? `${(share * 100).toFixed(share < 0.01 ? 2 : 1)}%` : "—";
	return (
		<div className="p-2 text-center" style={{ backgroundColor }}>
			<div className="font-semibold tabular-nums">
				{round(value)}
				<span className="ml-1 text-xs font-normal text-muted-foreground">
					{shareText}
				</span>
			</div>
			<div className="text-[11px] text-muted-foreground">
				<InfoTip text={info}>{caption}</InfoTip>
			</div>
		</div>
	);
}

/**
 * Per-slot attribution table: where the plan culls, which culls threw away
 * winners, the resources sunk there, and what relaxing each gate would do. This
 * is where a global "too aggressive" verdict gets pinned to a specific gate.
 */
function GateBreakdown({ result }: { result: SimulationResult }) {
	return (
		<Card className="p-4">
			<div className="mb-2 text-sm font-semibold">
				<InfoTip text="Breaks the plan down gate by gate. 'Winners killed' are discards whose full roll would have been perfect; 'Relax gate' shows what removing that one gate would recover and what it would add in cost. Use it to find the single gate to loosen or tighten.">
					Per-slot gate breakdown
				</InfoTip>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-left text-xs text-muted-foreground">
							<th className="py-1 pr-3 font-medium">Slot</th>
							<th className="py-1 pr-3 font-medium">Reached</th>
							<th className="py-1 pr-3 font-medium">Discarded</th>
							<th className="py-1 pr-3 font-medium">
								<InfoTip text="Discards at this slot whose finished echo would have met your target — winners the gate threw away.">
									Winners killed
								</InfoTip>
							</th>
							<th className="py-1 pr-3 font-medium">
								<InfoTip text="Net resources (after refunds) sunk into every echo discarded at this slot. Later slots cost far more — the EXP curve is steep.">
									Wasted here
								</InfoTip>
							</th>
							<th className="py-1 font-medium">
								<InfoTip text="What removing this gate would do: how many more perfect echoes you'd keep, how many more duds you'd fully level, and the extra net resources spent.">
									Relax gate
								</InfoTip>
							</th>
						</tr>
					</thead>
					<tbody className="tabular-nums">
						{result.discardsByStage.map((discarded, i) => {
							const reached = result.reachedByStage[i];
							const winners = result.perfectDiscardsByStage[i];
							const cullRate = reached > 0 ? discarded / reached : 0;
							const sens = result.gateSensitivity[i];
							return (
								<tr
									// biome-ignore lint/suspicious/noArrayIndexKey: fixed 5 slots
									key={i}
									className="border-t border-border/60"
								>
									<td className="py-1.5 pr-3 font-medium">{i + 1}</td>
									<td className="py-1.5 pr-3 text-muted-foreground">
										{round(reached)}
									</td>
									<td className="py-1.5 pr-3">
										{round(discarded)}
										<span className="ml-1 text-xs text-muted-foreground">
											{pct(cullRate)}
										</span>
									</td>
									<td
										className={`py-1.5 pr-3 ${winners > 0 ? "text-destructive" : "text-muted-foreground"}`}
									>
										{round(winners)}
									</td>
									<td className="py-1.5 pr-3">
										<InfoTip
											text={`${round(result.wastedByStage[i].echoExp)} EXP · ${round(result.wastedByStage[i].tuners)} Tuners · ${round(result.wastedByStage[i].shellCredit)} Shell`}
										>
											{compactExp(result.wastedByStage[i].echoExp)}
										</InfoTip>
									</td>
									<td className="py-1.5">
										{!sens.hasGate ? (
											<span className="text-muted-foreground">no gate</span>
										) : sens.newKeeps === 0 ? (
											<span className="text-muted-foreground">no effect</span>
										) : (
											<span className="flex flex-wrap items-center gap-x-2 text-xs">
												<span className="text-primary">
													+{round(sens.recoversPerfect)} perfect
												</span>
												<span className="text-destructive">
													+{round(sens.addsImperfect)} duds
												</span>
												<InfoTip
													text={`Extra net spend if removed: ${round(sens.addedNet.echoExp)} EXP · ${round(sens.addedNet.tuners)} Tuners · ${round(sens.addedNet.shellCredit)} Shell`}
												>
													+{compactExp(sens.addedNet.echoExp)} EXP
												</InfoTip>
											</span>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</Card>
	);
}

/**
 * Analytic (no-sim) panel: each desired stat's standalone chance of landing on a
 * finished echo, plus whether any gate actually checks for it. Explains a low
 * perfect rate that no gate change can fix — the target itself is the bottleneck.
 */
function TargetDifficulty({
	result,
	strategy,
}: {
	result: SimulationResult;
	strategy: LevelUpStrategy;
}) {
	if (strategy.target.length === 0) {
		return null;
	}

	const gatedStats = new Set<SubstatId>();
	for (const gate of strategy.gates) {
		if (gate) gateSubstats(gate, gatedStats);
	}

	const rows = strategy.target
		.map((req) => ({
			req,
			chance: calculateRollChance([req]).probability,
			gated: gatedStats.has(req.substat),
		}))
		// Hardest first — the bottleneck sits at the top.
		.sort((a, b) => a.chance - b.chance);
	const maxChance = Math.max(...rows.map((r) => r.chance), 1e-9);
	const combined = calculateRollChance(strategy.target).probability;

	return (
		<Card className="p-4">
			<div className="mb-1 text-sm font-semibold">
				<InfoTip text="How hard each desired stat is to roll on its own (its type appearing AND meeting your minimum), independent of your gates. The lowest bar is your bottleneck — no gate change can push the perfect rate above what the roll table allows.">
					Target difficulty & coverage
				</InfoTip>
			</div>
			<div className="mb-3 text-xs text-muted-foreground">
				Combined perfect chance{" "}
				<span className="font-medium text-foreground tabular-nums">
					{pct(combined)}
				</span>{" "}
				— the baseline perfect rate ({pct(result.baselinePerfectRate)}) any plan
				is capped by.
			</div>
			<div className="space-y-2">
				{rows.map(({ req, chance, gated }) => (
					<div
						key={`${req.substat}-${req.min}`}
						className="flex items-center gap-3"
					>
						<div className="w-40 shrink-0 truncate text-xs">
							{getSubstat(req.substat).label}
							<span className="text-muted-foreground">
								{" ≥ "}
								{formatValue(req.substat, req.min)}
							</span>
						</div>
						<div className="relative h-3 flex-1 overflow-hidden rounded bg-muted">
							<div
								className="h-full rounded bg-primary"
								style={{ width: `${(chance / maxChance) * 100}%` }}
							/>
						</div>
						<div className="w-12 shrink-0 text-right text-xs tabular-nums">
							{pct(chance)}
						</div>
						<Badge
							variant={gated ? "secondary" : "outline"}
							className={
								gated
									? "shrink-0"
									: "shrink-0 border-destructive/50 text-destructive"
							}
						>
							{gated ? "gated" : "not gated"}
						</Badge>
					</div>
				))}
			</div>
			<p className="mt-3 text-[11px] text-muted-foreground">
				“Not gated” means no gate ever requires this stat, so echoes missing it
				are still leveled to completion — a source of maxed duds.
			</p>
		</Card>
	);
}

export function SimulationResults({
	result,
	strategy,
}: {
	result: SimulationResult;
	strategy: LevelUpStrategy;
}) {
	const discardData = result.discardsByStage.map((count, index) => ({
		slot: `Slot ${index + 1}`,
		winners: result.perfectDiscardsByStage[index],
		culls: count - result.perfectDiscardsByStage[index],
	}));

	// Trim trailing empty histogram bins for a tidy chart.
	let lastNonZero = 0;
	result.costHistogram.forEach((bin, index) => {
		if (bin.count > 0) lastNonZero = index;
	});
	const histData = result.costHistogram
		.slice(0, lastNonZero + 1)
		.map((bin) => ({
			echoes: Math.round(bin.bucket / FULL_ECHO_EXP),
			count: bin.count,
		}));

	const savings =
		isFiniteVector(result.trueCostPerPerfect) &&
		isFiniteVector(result.baselineCostPerPerfect) &&
		result.baselineCostPerPerfect.echoExp > 0
			? 1 -
				result.trueCostPerPerfect.echoExp /
					result.baselineCostPerPerfect.echoExp
			: null;

	return (
		<div className="space-y-4">
			{/* Headline */}
			<Card className="p-4">
				<div className="text-xs text-muted-foreground">
					<InfoTip text="Every resource spent across the whole run (after refunding broken-down discards), divided by the number of perfect echoes you actually kept. The real average cost to obtain one perfect echo under this plan.">
						Net resources per perfect echo
					</InfoTip>
				</div>
				<div className="mt-1 font-heading text-2xl font-bold text-primary">
					<Resources value={result.trueCostPerPerfect} />
				</div>
				<div className="mt-1 text-sm text-muted-foreground">
					{Number.isFinite(result.echoesPerPerfect)
						? `≈ ${round(result.echoesPerPerfect)} echoes farmed per perfect one`
						: "no perfect echo was ever kept — loosen the plan or lower the target"}
					{savings !== null && (
						<>
							{" · "}
							<span
								className={savings >= 0 ? "text-primary" : "text-destructive"}
							>
								{savings >= 0
									? `saves ${pct(savings)} vs. leveling everything`
									: `costs ${pct(-savings)} more than leveling everything`}
							</span>
						</>
					)}
				</div>
			</Card>

			{/* Key rates */}
			<Card className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
				<Stat
					label="Kept"
					hint={`${round(result.kept)} / ${round(result.samples)}`}
					info="Share of rolled echoes that passed every gate and were leveled all the way to 25 — the echoes your plan chose to fully invest in."
				>
					{pct(result.keptRate)}
				</Stat>
				<Stat
					label="Perfect keeps"
					hint="kept AND on-target"
					info="Echoes that were both kept and met all of your desired stats at their minimum rolls — the outcomes you actually want."
				>
					{round(result.perfectKeeps)}
				</Stat>
				<Stat
					label="Avg slot reached"
					hint="before keep/discard"
					info="On average, how many of the 5 substat slots an echo revealed before your plan kept or discarded it. Lower means the plan culls earlier, which is cheaper."
				>
					{result.avgStageReached.toFixed(2)}
				</Stat>
				<Stat
					label="Baseline perfect rate"
					hint="if you never discard"
					info="How often a fully-leveled echo meets your target if you never discard anything — the raw roll chance of a perfect echo. Your plan is measured against this."
				>
					{pct(result.baselinePerfectRate)}
				</Stat>
			</Card>

			{/* Confusion matrix */}
			<Card className="p-4">
				<div className="mb-2 text-sm font-semibold">
					<InfoTip text="Cross-tabulates what your plan did (kept vs. discarded) against what each echo's full roll actually was (perfect vs. not). The two diagonals are wins; the off-diagonals are the plan's mistakes.">
						Plan vs. “perfect” outcomes
					</InfoTip>
				</div>
				<div className="grid grid-cols-[auto_1fr_1fr] gap-px overflow-hidden rounded-md border border-border bg-border text-sm">
					<div className="bg-card p-2" />
					<div className="bg-card p-2 text-center text-xs font-medium text-muted-foreground">
						would be perfect
					</div>
					<div className="bg-card p-2 text-center text-xs font-medium text-muted-foreground">
						not perfect
					</div>

					<div className="flex items-center bg-card p-2 text-xs font-medium text-muted-foreground">
						kept
					</div>
					<MatrixCell
						value={result.perfectKeeps}
						total={result.samples}
						caption="what you wanted"
						kind="good"
						info="Kept and perfect: the plan invested fully and got exactly the echo you were after."
					/>
					<MatrixCell
						value={result.imperfectKeeps}
						total={result.samples}
						caption="too lenient — maxed a dud"
						kind="mistake"
						info="Kept but not perfect: leveled to 25 at full cost (no refund) even though it misses your target. A high count means your gates are too loose."
					/>

					<div className="flex items-center bg-card p-2 text-xs font-medium text-muted-foreground">
						discarded
					</div>
					<MatrixCell
						value={result.perfectButDiscarded}
						total={result.samples}
						caption="too aggressive — threw away a winner"
						kind="mistake"
						info="Discarded early, but its full roll would have been perfect. A high count means your gates are too strict and cull winners before they finish."
					/>
					<MatrixCell
						value={result.correctDiscards}
						total={result.samples}
						caption="correct cull"
						kind="good"
						info="Discarded and would not have been perfect anyway — resources correctly saved."
					/>
				</div>
			</Card>

			{/* Per-slot gate breakdown — the "which gate is the problem" table */}
			<GateBreakdown result={result} />

			{/* Target difficulty & coverage — analytic, no sim */}
			<TargetDifficulty result={result} strategy={strategy} />

			{/* Cost distribution */}
			<Card className="grid gap-4 p-4 sm:grid-cols-3">
				<Stat
					label="Cheapest perfect echo"
					hint="lucky streak"
					info="The luckiest acquisition in the run: the fewest net resources spent between two consecutive perfect keeps."
				>
					<Resources value={result.costPerPerfect.min} />
				</Stat>
				<Stat
					label="Average"
					hint={`${round(result.costPerPerfect.count)} acquisitions`}
					info="Mean net resources spent to acquire one perfect echo, averaged over every perfect keep in the run."
				>
					<Resources value={result.costPerPerfect.avg} />
				</Stat>
				<Stat
					label="Most expensive"
					hint="unlucky streak"
					info="The unluckiest acquisition: the most net resources spent before finally landing a perfect keep."
				>
					<Resources value={result.costPerPerfect.max} />
				</Stat>
			</Card>

			{/* Charts */}
			<div className="grid gap-4 lg:grid-cols-2">
				<Card className="p-4">
					<div className="mb-2 text-sm font-semibold">
						<InfoTip text="How many echoes the plan discarded at each slot, split into correct culls (would not have been perfect) and winners killed (would have been perfect). A tall red segment marks an over-aggressive gate. Culling early is far cheaper — the EXP curve is steep.">
							Where the plan discards
						</InfoTip>
					</div>
					<div className="mb-2 flex gap-4 text-[11px] text-muted-foreground">
						<span className="flex items-center gap-1">
							<span className="inline-block size-2 rounded-sm bg-primary" />
							correct culls
						</span>
						<span className="flex items-center gap-1">
							<span className="inline-block size-2 rounded-sm bg-destructive" />
							winners killed
						</span>
					</div>
					<div className="h-48">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={discardData}>
								<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
								<XAxis
									dataKey="slot"
									tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
								/>
								<YAxis
									tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
								/>
								<RechartsTooltip
									contentStyle={{
										background: "var(--popover)",
										border: "1px solid var(--border)",
										borderRadius: 8,
										fontSize: 12,
									}}
								/>
								<Bar dataKey="culls" stackId="discards" fill="var(--primary)" />
								<Bar
									dataKey="winners"
									stackId="discards"
									radius={[4, 4, 0, 0]}
									fill="var(--destructive)"
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</Card>

				<Card className="p-4">
					<div className="mb-2 text-sm font-semibold">
						<InfoTip text="Distribution of the cost to acquire a perfect echo, bucketed by how many fully-leveled echoes' worth of EXP each one took. A long right tail means high variance — some perfect echoes cost far more than average due to unlucky streaks.">
							Cost per perfect echo (in full-echo EXP)
						</InfoTip>
					</div>
					<div className="h-48">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={histData}>
								<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
								<XAxis
									dataKey="echoes"
									tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
								/>
								<YAxis
									tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
								/>
								<RechartsTooltip
									contentStyle={{
										background: "var(--popover)",
										border: "1px solid var(--border)",
										borderRadius: 8,
										fontSize: 12,
									}}
								/>
								<Bar
									dataKey="count"
									radius={[4, 4, 0, 0]}
									fill="var(--primary)"
								>
									{histData.map((entry) => (
										<Cell key={entry.echoes} />
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</Card>
			</div>
		</div>
	);
}
