import { useCallback, useEffect, useState } from "react";
import type { InferenceProgress } from "../hooks/useInference";
import { getSetting, setSetting } from "../lib/tauri";
import type { Endpoint, InferenceResult } from "../types";

interface InferencePanelProps {
	endpoints: Endpoint[];
	results: InferenceResult[];
	progress: InferenceProgress;
	onRun: (endpoints: Endpoint[]) => void;
	onCancel: () => void;
}

export function InferencePanel({
	endpoints,
	results,
	progress,
	onRun,
	onCancel,
}: InferencePanelProps) {
	const [apiKey, setApiKey] = useState("");
	const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
	const [selected, setSelected] = useState<Set<number>>(new Set());

	// Load API key from settings
	useEffect(() => {
		getSetting("anthropic_api_key")
			.then((key) => {
				if (key) setApiKey(key);
				setApiKeyLoaded(true);
			})
			.catch(() => setApiKeyLoaded(true));
	}, []);

	// Select all non-inferred endpoints by default
	useEffect(() => {
		const inferredIds = new Set(results.map((r) => r.endpointId));
		const uninferred = endpoints
			.filter((ep) => !inferredIds.has(ep.id))
			.map((ep) => ep.id);
		setSelected(new Set(uninferred));
	}, [endpoints, results]);

	const handleSaveKey = useCallback(async () => {
		if (apiKey.trim()) {
			await setSetting("anthropic_api_key", apiKey.trim());
		}
	}, [apiKey]);

	const toggleEndpoint = useCallback((id: number) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	const selectAll = useCallback(() => {
		setSelected(new Set(endpoints.map((ep) => ep.id)));
	}, [endpoints]);

	const selectNone = useCallback(() => {
		setSelected(new Set());
	}, []);

	const handleRun = useCallback(() => {
		const selectedEndpoints = endpoints.filter((ep) => selected.has(ep.id));
		onRun(selectedEndpoints);
	}, [endpoints, selected, onRun]);

	const isRunning = progress.status === "running";
	const canRun = apiKey.trim().length > 0 && selected.size > 0 && !isRunning;

	return (
		<div className="flex h-full flex-col">
			{/* API Key Section */}
			<div
				className="border-b px-5 py-4"
				style={{ borderColor: "var(--border)" }}
			>
				<label
					className="mb-1 block text-xs uppercase tracking-wider"
					style={{ color: "var(--text-secondary)" }}
				>
					Anthropic API Key
				</label>
				<div className="flex gap-2">
					<input
						type="password"
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						onBlur={handleSaveKey}
						placeholder={apiKeyLoaded ? "sk-ant-..." : "Loading..."}
						className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
						style={{
							borderColor: "var(--border)",
							background: "var(--bg-tertiary)",
							color: "var(--text-primary)",
						}}
					/>
				</div>
			</div>

			{/* Progress / Status */}
			{isRunning && (
				<div
					className="border-b px-5 py-3"
					style={{ borderColor: "var(--border)" }}
				>
					<div className="mb-2 flex items-center justify-between text-sm">
						<span style={{ color: "var(--text-primary)" }}>
							{progress.currentEndpoint ?? "Starting..."}
						</span>
						<span style={{ color: "var(--text-secondary)" }}>
							{progress.completed}/{progress.total}
						</span>
					</div>
					<div
						className="h-1.5 w-full overflow-hidden rounded-full"
						style={{ background: "var(--bg-tertiary)" }}
					>
						<div
							className="h-full rounded-full transition-all"
							style={{
								width: `${(progress.completed / Math.max(progress.total, 1)) * 100}%`,
								background: "var(--accent)",
							}}
						/>
					</div>
					<div className="mt-2 flex items-center justify-between">
						<span
							className="text-xs"
							style={{ color: "var(--text-secondary)" }}
						>
							{progress.tokensUsed.toLocaleString()} tokens used
						</span>
						<button
							onClick={onCancel}
							className="text-xs"
							style={{ color: "#f87171" }}
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{progress.status === "complete" && (
				<div
					className="border-b px-5 py-3"
					style={{
						borderColor: "var(--border)",
						background: "rgba(34, 197, 94, 0.05)",
					}}
				>
					<p className="text-sm" style={{ color: "#4ade80" }}>
						Analysis complete &mdash; {progress.completed} endpoints,{" "}
						{progress.tokensUsed.toLocaleString()} tokens
					</p>
					{progress.errors.length > 0 && (
						<p className="mt-1 text-xs" style={{ color: "#fbbf24" }}>
							{progress.errors.length} endpoint(s) failed
						</p>
					)}
				</div>
			)}

			{/* Endpoint Selection */}
			<div
				className="flex items-center justify-between border-b px-5 py-2"
				style={{ borderColor: "var(--border)" }}
			>
				<span
					className="text-sm font-medium"
					style={{ color: "var(--text-primary)" }}
				>
					Endpoints ({selected.size}/{endpoints.length})
				</span>
				<div className="flex gap-3">
					<button
						onClick={selectAll}
						className="text-xs"
						style={{ color: "var(--accent)" }}
					>
						All
					</button>
					<button
						onClick={selectNone}
						className="text-xs"
						style={{ color: "var(--text-secondary)" }}
					>
						None
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				{endpoints.map((ep) => {
					const result = results.find((r) => r.endpointId === ep.id);
					return (
						<label
							key={ep.id}
							className="flex cursor-pointer items-center gap-3 border-b px-5 py-2 hover:bg-white/5"
							style={{ borderColor: "var(--border)" }}
						>
							<input
								type="checkbox"
								checked={selected.has(ep.id)}
								onChange={() => toggleEndpoint(ep.id)}
								disabled={isRunning}
							/>
							<span
								className="text-xs font-mono"
								style={{
									color: result
										? "var(--text-secondary)"
										: "var(--text-primary)",
								}}
							>
								{ep.method} {ep.normalizedPath}
							</span>
							{result?.inferredName && (
								<span className="ml-auto text-xs" style={{ color: "#4ade80" }}>
									{result.inferredName}
								</span>
							)}
						</label>
					);
				})}
			</div>

			{/* Run Button */}
			<div
				className="border-t px-5 py-3"
				style={{ borderColor: "var(--border)" }}
			>
				<button
					onClick={handleRun}
					disabled={!canRun}
					className="w-full rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-40"
					style={{
						background: "var(--accent)",
						color: "#fff",
					}}
				>
					{isRunning
						? "Running..."
						: `Run AI Analysis (${selected.size} endpoints)`}
				</button>
			</div>
		</div>
	);
}
