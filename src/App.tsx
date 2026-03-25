import { useEffect, useState } from "react";
import { createSession, listSessions } from "./lib/tauri";
import type { Session } from "./types";

function App() {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		listSessions()
			.then(setSessions)
			.catch((e: unknown) => setError(String(e)))
			.finally(() => setLoading(false));
	}, []);

	async function handleCreateSession() {
		try {
			const session = await createSession("Test Session", "extension");
			setSessions((prev) => [session, ...prev]);
		} catch (e: unknown) {
			setError(String(e));
		}
	}

	return (
		<div
			className="min-h-screen p-8"
			style={{ background: "var(--bg-primary)" }}
		>
			<header className="mb-12">
				<h1
					className="text-4xl font-light tracking-tight"
					style={{ color: "var(--text-primary)" }}
				>
					apispy
				</h1>
				<p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
					API reverse engineering toolkit
				</p>
			</header>

			{error && (
				<div
					className="mb-6 rounded-lg border px-4 py-3 text-sm"
					style={{
						borderColor: "#dc2626",
						background: "rgba(220, 38, 38, 0.1)",
						color: "#fca5a5",
					}}
				>
					{error}
				</div>
			)}

			<section>
				<div className="mb-6 flex items-center justify-between">
					<h2
						className="text-lg font-medium"
						style={{ color: "var(--text-primary)" }}
					>
						Sessions
					</h2>
					<button
						onClick={handleCreateSession}
						className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
						style={{
							background: "var(--accent)",
							color: "#fff",
						}}
						onMouseEnter={(e) =>
							(e.currentTarget.style.background = "var(--accent-hover)")
						}
						onMouseLeave={(e) =>
							(e.currentTarget.style.background = "var(--accent)")
						}
					>
						New Session
					</button>
				</div>

				{loading ? (
					<p style={{ color: "var(--text-secondary)" }}>Loading...</p>
				) : sessions.length === 0 ? (
					<div
						className="rounded-xl border p-12 text-center"
						style={{
							borderColor: "var(--border)",
							background: "var(--bg-secondary)",
						}}
					>
						<p
							className="text-lg font-light"
							style={{ color: "var(--text-secondary)" }}
						>
							No sessions yet
						</p>
						<p
							className="mt-2 text-sm"
							style={{ color: "var(--text-secondary)" }}
						>
							Create a session to start capturing API traffic
						</p>
					</div>
				) : (
					<ul className="space-y-3">
						{sessions.map((s) => (
							<li
								key={s.id}
								className="rounded-xl border px-5 py-4"
								style={{
									borderColor: "var(--border)",
									background: "var(--bg-secondary)",
								}}
							>
								<div className="flex items-center justify-between">
									<div>
										<span
											className="font-medium"
											style={{ color: "var(--text-primary)" }}
										>
											{s.name}
										</span>
										<span
											className="ml-3 text-xs uppercase tracking-wider"
											style={{ color: "var(--text-secondary)" }}
										>
											{s.captureMode}
										</span>
									</div>
									<div className="flex items-center gap-4">
										<span
											className="text-sm"
											style={{ color: "var(--text-secondary)" }}
										>
											{s.requestCount} requests
										</span>
										<span
											className="rounded-full px-2 py-0.5 text-xs"
											style={{
												background:
													s.status === "active"
														? "rgba(34, 197, 94, 0.15)"
														: "rgba(163, 163, 163, 0.15)",
												color: s.status === "active" ? "#4ade80" : "#a3a3a3",
											}}
										>
											{s.status}
										</span>
									</div>
								</div>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}

export default App;
