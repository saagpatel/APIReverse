import { useState } from "react";
import { CaptureBar } from "./components/CaptureBar";
import { EndpointMap } from "./components/EndpointMap";
import { RequestList } from "./components/RequestList";
import { useCapture } from "./hooks/useCapture";
import { useSession } from "./hooks/useSession";

function App() {
	const session = useSession();
	const capture = useCapture(session.activeSession?.id ?? null);
	const [showNoise, setShowNoise] = useState(false);

	async function handleNewSession() {
		const name = `Session ${new Date().toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		})}`;
		await session.create(name);
	}

	async function handleStart() {
		await session.start();
	}

	async function handleStop() {
		await session.stop();
	}

	return (
		<div
			className="flex h-screen flex-col"
			style={{ background: "var(--bg-primary)" }}
		>
			{/* Top bar */}
			<CaptureBar
				sessionName={session.activeSession?.name ?? null}
				isCapturing={session.isCapturing}
				requestCount={capture.requestCount}
				endpointCount={capture.endpointCount}
				onStart={handleStart}
				onStop={handleStop}
				onNewSession={handleNewSession}
			/>

			{/* Error banner */}
			{session.error && (
				<div
					className="flex items-center justify-between border-b px-4 py-2 text-sm"
					style={{
						borderColor: "#dc2626",
						background: "rgba(220, 38, 38, 0.1)",
						color: "#fca5a5",
					}}
				>
					<span>{session.error}</span>
					<button
						onClick={session.clearError}
						className="ml-4 text-xs underline"
					>
						Dismiss
					</button>
				</div>
			)}

			{/* Main content */}
			{session.activeSession ? (
				<div className="flex min-h-0 flex-1">
					{/* Request list — left panel */}
					<div
						className="flex-1 border-r"
						style={{ borderColor: "var(--border)" }}
					>
						<RequestList
							requests={capture.requests}
							showNoise={showNoise}
							onToggleNoise={() => setShowNoise((v) => !v)}
						/>
					</div>

					{/* Endpoint map — right panel */}
					<div className="flex-1">
						<EndpointMap endpoints={capture.endpoints} />
					</div>
				</div>
			) : (
				<div className="flex flex-1 items-center justify-center">
					<div className="text-center">
						<h2
							className="mb-2 text-2xl font-light tracking-tight"
							style={{ color: "var(--text-primary)" }}
						>
							apispy
						</h2>
						<p
							className="mb-8 text-sm"
							style={{ color: "var(--text-secondary)" }}
						>
							Create a session to start capturing API traffic
						</p>

						{session.sessions.length > 0 && (
							<div className="mb-8">
								<p
									className="mb-3 text-xs uppercase tracking-wider"
									style={{ color: "var(--text-secondary)" }}
								>
									Recent sessions
								</p>
								<ul className="space-y-2">
									{session.sessions.slice(0, 5).map((s) => (
										<li key={s.id}>
											<button
												onClick={() => session.selectSession(s)}
												className="w-64 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-white/5"
												style={{
													borderColor: "var(--border)",
												}}
											>
												<span
													className="block text-sm font-medium"
													style={{
														color: "var(--text-primary)",
													}}
												>
													{s.name}
												</span>
												<span
													className="text-xs"
													style={{
														color: "var(--text-secondary)",
													}}
												>
													{s.requestCount} requests &middot; {s.status}
												</span>
											</button>
										</li>
									))}
								</ul>
							</div>
						)}

						<button
							onClick={handleNewSession}
							className="rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
							style={{
								background: "var(--accent)",
								color: "#fff",
							}}
						>
							New Session
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

export default App;
