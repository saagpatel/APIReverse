import { useState } from "react";
import { CASetupModal } from "./components/CASetupModal";
import { CaptureBar } from "./components/CaptureBar";
import { CollectionPreview } from "./components/CollectionPreview";
import { EndpointMap } from "./components/EndpointMap";
import { FilterConfig } from "./components/FilterConfig";
import { InferencePanel } from "./components/InferencePanel";
import { OnboardingModal } from "./components/OnboardingModal";
import { RequestList } from "./components/RequestList";
import { SessionManager } from "./components/SessionManager";
import { useCapture } from "./hooks/useCapture";
import { useInference } from "./hooks/useInference";
import { useSession } from "./hooks/useSession";
import type { FilterConfig as FilterConfigType } from "./types";

type TabId = "capture" | "analysis" | "export";

function App() {
	const session = useSession();
	const capture = useCapture(session.activeSession?.id ?? null);
	const inference = useInference(session.activeSession?.id ?? null);
	const [showNoise, setShowNoise] = useState(false);
	const [activeTab, setActiveTab] = useState<TabId>("capture");
	const [showSidebar, setShowSidebar] = useState(false);
	const [showFilters, setShowFilters] = useState(false);
	const [filterConfig, setFilterConfig] = useState<FilterConfigType>({
		allowlist: [],
		denylist: [],
		noisePresets: [],
		pathExcludePatterns: [],
	});

	async function handleNewSession() {
		const name = `Session ${new Date().toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		})}`;
		const s = await session.create(name);
		if (s) setActiveTab("capture");
	}

	async function handleOnboardingComplete(sessionName: string) {
		session.setShowOnboarding(false);
		const s = await session.create(sessionName);
		if (s) {
			await session.start(s);
			setActiveTab("capture");
		}
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
				captureMode={session.captureMode}
				proxyStatus={session.proxyStatus}
				requestCount={capture.requestCount}
				endpointCount={capture.endpointCount}
				onStart={() => session.start()}
				onStop={() => session.stop()}
				onNewSession={handleNewSession}
				onModeChange={session.setCaptureMode}
				onToggleSidebar={() => setShowSidebar((v) => !v)}
				onToggleFilters={
					session.activeSession ? () => setShowFilters((v) => !v) : undefined
				}
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

			{/* Main area */}
			<div className="flex min-h-0 flex-1">
				{/* Session sidebar */}
				{showSidebar && (
					<SessionManager
						sessions={session.sessions}
						activeSessionId={session.activeSession?.id ?? null}
						onSelect={(s) => {
							session.selectSession(s);
							setShowSidebar(false);
						}}
						onRename={session.rename}
						onDelete={session.remove}
						onClose={() => setShowSidebar(false)}
					/>
				)}

				{/* Content area */}
				<div className="flex min-w-0 flex-1 flex-col">
					{session.activeSession ? (
						<>
							{/* Filter config panel */}
							{showFilters && session.activeSession && (
								<div
									className="border-b"
									style={{ borderColor: "var(--border)" }}
								>
									<FilterConfig
										sessionId={session.activeSession.id}
										config={filterConfig}
										onChange={setFilterConfig}
									/>
								</div>
							)}

							{/* Tab bar */}
							<div
								className="flex border-b"
								style={{ borderColor: "var(--border)" }}
							>
								{(
									[
										{ id: "capture", label: "Capture" },
										{ id: "analysis", label: "Analysis" },
										{ id: "export", label: "Export" },
									] as const
								).map((tab) => (
									<button
										key={tab.id}
										onClick={() => setActiveTab(tab.id)}
										className="px-5 py-2 text-sm font-medium transition-colors"
										style={{
											color:
												activeTab === tab.id
													? "var(--accent)"
													: "var(--text-secondary)",
											borderBottom:
												activeTab === tab.id
													? "2px solid var(--accent)"
													: "2px solid transparent",
										}}
									>
										{tab.label}
									</button>
								))}
							</div>

							{/* Tab content */}
							<div className="min-h-0 flex-1">
								{activeTab === "capture" && (
									<div className="flex h-full">
										<div
											className="flex-1 border-r"
											style={{
												borderColor: "var(--border)",
											}}
										>
											<RequestList
												requests={capture.requests}
												showNoise={showNoise}
												onToggleNoise={() => setShowNoise((v) => !v)}
											/>
										</div>
										<div className="flex-1">
											<EndpointMap endpoints={capture.endpoints} />
										</div>
									</div>
								)}

								{activeTab === "analysis" && (
									<InferencePanel
										endpoints={capture.endpoints}
										results={inference.results}
										progress={inference.progress}
										onRun={inference.run}
										onCancel={inference.cancel}
									/>
								)}

								{activeTab === "export" && (
									<CollectionPreview
										sessionName={session.activeSession?.name ?? "Untitled"}
										endpoints={capture.endpoints}
										results={inference.results}
									/>
								)}
							</div>
						</>
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
											style={{
												color: "var(--text-secondary)",
											}}
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
			</div>

			{/* Modals */}
			<CASetupModal
				open={session.showCaModal}
				onClose={() => session.setShowCaModal(false)}
				onInstalled={() => session.setShowCaModal(false)}
			/>

			<OnboardingModal
				open={session.showOnboarding}
				onComplete={handleOnboardingComplete}
				onOpenCaModal={() => session.setShowCaModal(true)}
			/>
		</div>
	);
}

export default App;
