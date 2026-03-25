import { useCallback, useState } from "react";
import { setSetting } from "../lib/tauri";

interface OnboardingModalProps {
	open: boolean;
	onComplete: (sessionName: string) => void;
	onOpenCaModal: () => void;
}

type Step = 1 | 2 | 3;

export function OnboardingModal({
	open,
	onComplete,
	onOpenCaModal,
}: OnboardingModalProps) {
	const [step, setStep] = useState<Step>(1);
	const [sessionName, setSessionName] = useState("My First Session");

	const handleComplete = useCallback(async () => {
		await setSetting("onboarding_complete", "true");
		onComplete(sessionName.trim() || "My First Session");
	}, [sessionName, onComplete]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center"
			style={{ background: "rgba(0, 0, 0, 0.7)" }}
		>
			<div
				className="w-full max-w-lg rounded-xl border p-8"
				style={{
					background: "var(--bg-secondary)",
					borderColor: "var(--border)",
				}}
			>
				<h2
					className="mb-1 text-xl font-light"
					style={{ color: "var(--text-primary)" }}
				>
					Welcome to apispy
				</h2>
				<p className="mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
					Step {step} of 3
				</p>

				{/* Step indicator */}
				<div className="mb-6 flex gap-2">
					{([1, 2, 3] as const).map((s) => (
						<div
							key={s}
							className="h-1 flex-1 rounded-full"
							style={{
								background: s <= step ? "var(--accent)" : "var(--bg-tertiary)",
							}}
						/>
					))}
				</div>

				{step === 1 && (
					<div className="space-y-4">
						<h3
							className="text-sm font-medium"
							style={{ color: "var(--text-primary)" }}
						>
							Install the Chrome Extension
						</h3>
						<ol
							className="list-inside list-decimal space-y-2 text-sm"
							style={{ color: "var(--text-secondary)" }}
						>
							<li>
								Open Chrome and navigate to{" "}
								<span
									className="font-mono text-xs"
									style={{ color: "var(--accent)" }}
								>
									chrome://extensions
								</span>
							</li>
							<li>Enable "Developer mode" (top right toggle)</li>
							<li>
								Click "Load unpacked" and select the{" "}
								<span
									className="font-mono text-xs"
									style={{ color: "var(--text-primary)" }}
								>
									extension/chrome
								</span>{" "}
								folder from this project
							</li>
							<li>Verify "APIspy" appears in the extensions list</li>
						</ol>
						<button
							onClick={() => setStep(2)}
							className="mt-4 rounded-lg px-5 py-2 text-sm font-medium"
							style={{ background: "var(--accent)", color: "#fff" }}
						>
							I've installed it
						</button>
					</div>
				)}

				{step === 2 && (
					<div className="space-y-4">
						<h3
							className="text-sm font-medium"
							style={{ color: "var(--text-primary)" }}
						>
							HTTPS Interception (Optional)
						</h3>
						<p className="text-sm" style={{ color: "var(--text-secondary)" }}>
							To capture full request/response bodies including HTTPS traffic,
							apispy can run a local MITM proxy. This requires installing a
							local CA certificate.
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => {
									onOpenCaModal();
									setStep(3);
								}}
								className="rounded-lg px-5 py-2 text-sm font-medium"
								style={{ background: "var(--accent)", color: "#fff" }}
							>
								Set up MITM
							</button>
							<button
								onClick={() => setStep(3)}
								className="rounded-lg px-5 py-2 text-sm"
								style={{ color: "var(--text-secondary)" }}
							>
								Skip for now
							</button>
						</div>
					</div>
				)}

				{step === 3 && (
					<div className="space-y-4">
						<h3
							className="text-sm font-medium"
							style={{ color: "var(--text-primary)" }}
						>
							Create Your First Session
						</h3>
						<div>
							<label
								className="mb-1 block text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								Session name
							</label>
							<input
								value={sessionName}
								onChange={(e) => setSessionName(e.target.value)}
								className="w-full rounded-lg border px-3 py-2 text-sm"
								style={{
									borderColor: "var(--border)",
									background: "var(--bg-tertiary)",
									color: "var(--text-primary)",
								}}
								autoFocus
							/>
						</div>
						<button
							onClick={handleComplete}
							className="rounded-lg px-5 py-2 text-sm font-medium"
							style={{ background: "var(--accent)", color: "#fff" }}
						>
							Start Capturing
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
