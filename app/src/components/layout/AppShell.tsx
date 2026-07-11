import { Button } from "@shiron/ui/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ModeToggle } from "@/components/layout/ModeToggle";

export function AppShell({
	children,
	wide = false,
}: {
	children: React.ReactNode;
	wide?: boolean;
}) {
	const maxWidth = wide ? "max-w-6xl" : "max-w-5xl";
	return (
		<div className="relative flex min-h-screen flex-col bg-background">
			<header className={`sticky top-4 z-50 mx-auto w-full ${maxWidth} px-4`}>
				<div className="glass grid h-12 grid-cols-[1fr_auto_1fr] items-center rounded-full border border-border pl-5 pr-2 shadow-sm">
					<div className="justify-self-start">
						<Link to="/" className="flex items-center gap-2">
							<span className="flex size-6 items-center justify-center rounded-md bg-primary font-heading text-xs font-bold text-primary-foreground">
								W
							</span>
							<span className="font-heading text-sm font-semibold tracking-tight">
								WaveUtils
							</span>
						</Link>
					</div>
					<nav className="justify-self-center">
						<div className="flex items-center gap-1">
							<Button variant="ghost" size="sm" asChild>
								<Link to="/roll-calculator">Roll Calculator</Link>
							</Button>
							<Button variant="ghost" size="sm" asChild>
								<Link to="/strategy-simulator">Strategy Simulator</Link>
							</Button>
						</div>
					</nav>
					<div className="flex items-center gap-1 justify-self-end">
						<ModeToggle />
					</div>
				</div>
			</header>
			<main
				className={`mx-auto w-full flex-1 px-4 py-10 ${wide ? "max-w-6xl" : "max-w-3xl"}`}
			>
				{children}
			</main>
			<footer className={`mx-auto w-full ${maxWidth} px-4 py-8`}>
				<p className="border-t border-border pt-6 text-center text-xs leading-relaxed text-muted-foreground">
					<a
						href="https://wutheringwaves.kurogames.com/en/main"
						target="_blank"
						rel="noopener noreferrer"
						className="underline underline-offset-2 transition-colors hover:text-foreground"
					>
						Wuthering Waves
					</a>{" "}
					is a trademark of{" "}
					<a
						href="https://www.kurogames.net/introduction"
						target="_blank"
						rel="noopener noreferrer"
						className="underline underline-offset-2 transition-colors hover:text-foreground"
					>
						Kuro Games
					</a>
					. WaveUtils is an unofficial, fan-made project and is not affiliated
					with, endorsed by, or associated with Kuro Games. All game data and
					related names are the property of their respective owners.
				</p>
			</footer>
		</div>
	);
}
