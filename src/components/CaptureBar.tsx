interface CaptureBarProps {
	sessionName: string | null;
	isCapturing: boolean;
	requestCount: number;
	endpointCount: number;
	onStart: () => void;
	onStop: () => void;
	onNewSession: () => void;
}

export function CaptureBar({
	sessionName,
	isCapturing,
	requestCount,
	endpointCount,
	onStart,
	onStop,
	onNewSession,
}: CaptureBarProps) {
	return (
		<div
			className="flex items-center justify-between border-b px-5 py-3"
			style={{
				borderColor: "var(--border)",
				background: "var(--bg-secondary)",
			}}
		>
			<div className="flex items-center gap-4">
				{/* Recording indicator */}
				<div className="flex items-center gap-2">
					{isCapturing && (
						<span
							className="inline-block h-2.5 w-2.5 rounded-full"
							style={{
								background: "#ef4444",
								animation: "pulse 1.5s infinite",
							}}
						/>
					)}
					<span
						className="text-sm font-medium"
						style={{ color: "var(--text-primary)" }}
					>
						{sessionName ?? "No session"}
					</span>
				</div>

				{/* Mode badge */}
				<span
					className="rounded px-2 py-0.5 text-xs uppercase tracking-wider"
					style={{
						background: "rgba(59, 130, 246, 0.15)",
						color: "#60a5fa",
					}}
				>
					Extension
				</span>
			</div>

			<div className="flex items-center gap-6">
				{/* Live counters */}
				<div
					className="flex items-center gap-4 text-sm"
					style={{ color: "var(--text-secondary)" }}
				>
					<span>{requestCount} requests</span>
					<span className="h-3 w-px" style={{ background: "var(--border)" }} />
					<span>{endpointCount} endpoints</span>
				</div>

				{/* Controls */}
				<div className="flex items-center gap-2">
					{sessionName ? (
						isCapturing ? (
							<button
								onClick={onStop}
								className="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
								style={{
									background: "rgba(239, 68, 68, 0.15)",
									color: "#f87171",
								}}
							>
								Stop
							</button>
						) : (
							<button
								onClick={onStart}
								className="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
								style={{
									background: "rgba(34, 197, 94, 0.15)",
									color: "#4ade80",
								}}
							>
								Record
							</button>
						)
					) : null}
					<button
						onClick={onNewSession}
						className="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
						style={{
							background: "var(--accent)",
							color: "#fff",
						}}
					>
						New Session
					</button>
				</div>
			</div>
		</div>
	);
}
