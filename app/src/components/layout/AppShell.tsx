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
		<div className="relative min-h-screen bg-background">
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
					<nav className="justify-self-center" />
					<div className="flex items-center gap-1 justify-self-end">
						<ModeToggle />
					</div>
				</div>
			</header>
			<main
				className={`mx-auto w-full px-4 py-10 ${wide ? "max-w-6xl" : "max-w-3xl"}`}
			>
				{children}
			</main>
		</div>
	);
}
