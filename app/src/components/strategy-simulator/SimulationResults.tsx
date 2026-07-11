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
import type { ResourceVector, SimulationResult } from "@/lib/echoes";

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

/** One confusion-matrix cell: a count plus a hover-explained caption. */
function MatrixCell({
	value,
	caption,
	info,
	tone,
}: {
	value: number;
	caption: string;
	info: string;
	tone?: "good" | "bad";
}) {
	const toneClass =
		tone === "good" ? "text-primary" : tone === "bad" ? "text-destructive" : "";
	return (
		<div className="bg-card p-2 text-center">
			<div className={`font-semibold tabular-nums ${toneClass}`}>
				{round(value)}
			</div>
			<div className="text-[11px] text-muted-foreground">
				<InfoTip text={info}>{caption}</InfoTip>
			</div>
		</div>
	);
}

export function SimulationResults({ result }: { result: SimulationResult }) {
	const discardData = result.discardsByStage.map((count, index) => ({
		slot: `Slot ${index + 1}`,
		count,
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
						caption="what you wanted"
						tone="good"
						info="Kept and perfect: the plan invested fully and got exactly the echo you were after."
					/>
					<MatrixCell
						value={result.imperfectKeeps}
						caption="too lenient — maxed a dud"
						info="Kept but not perfect: leveled to 25 at full cost (no refund) even though it misses your target. A high count means your gates are too loose."
					/>

					<div className="flex items-center bg-card p-2 text-xs font-medium text-muted-foreground">
						discarded
					</div>
					<MatrixCell
						value={result.perfectButDiscarded}
						caption="too aggressive — threw away a winner"
						tone="bad"
						info="Discarded early, but its full roll would have been perfect. A high count means your gates are too strict and cull winners before they finish."
					/>
					<MatrixCell
						value={result.correctDiscards}
						caption="correct cull"
						info="Discarded and would not have been perfect anyway — resources correctly saved."
					/>
				</div>
			</Card>

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
						<InfoTip text="How many echoes the plan discarded at each slot. Culling at earlier slots is far cheaper — the EXP curve is steep, so a slot-1 discard costs a tiny fraction of a slot-5 one.">
							Where the plan discards
						</InfoTip>
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
								<Bar
									dataKey="count"
									radius={[4, 4, 0, 0]}
									fill="var(--primary)"
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
