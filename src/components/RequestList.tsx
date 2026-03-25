import type { CapturedRequest } from "../types";

interface RequestListProps {
	requests: CapturedRequest[];
	showNoise: boolean;
	onToggleNoise: () => void;
}

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
	GET: { bg: "rgba(59, 130, 246, 0.15)", text: "#60a5fa" },
	POST: { bg: "rgba(34, 197, 94, 0.15)", text: "#4ade80" },
	PUT: { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24" },
	PATCH: { bg: "rgba(168, 85, 247, 0.15)", text: "#c084fc" },
	DELETE: { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171" },
	OPTIONS: { bg: "rgba(163, 163, 163, 0.15)", text: "#a3a3a3" },
	HEAD: { bg: "rgba(163, 163, 163, 0.15)", text: "#a3a3a3" },
};

function statusColor(status: number | undefined): string {
	if (!status) return "var(--text-secondary)";
	if (status >= 200 && status < 300) return "#4ade80";
	if (status >= 300 && status < 400) return "#60a5fa";
	if (status >= 400 && status < 500) return "#fbbf24";
	if (status >= 500) return "#f87171";
	return "var(--text-secondary)";
}

function relativeTime(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const seconds = Math.floor(diff / 1000);
	if (seconds < 5) return "now";
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ago`;
}

function truncateUrl(url: string, maxLen = 80): string {
	try {
		const u = new URL(url);
		const display = u.pathname + u.search;
		return display.length > maxLen
			? display.slice(0, maxLen) + "\u2026"
			: display;
	} catch {
		return url.length > maxLen ? url.slice(0, maxLen) + "\u2026" : url;
	}
}

export function RequestList({
	requests,
	showNoise,
	onToggleNoise,
}: RequestListProps) {
	const filtered = showNoise ? requests : requests.filter((r) => !r.isNoise);
	const noiseCount = requests.filter((r) => r.isNoise).length;

	return (
		<div className="flex h-full flex-col">
			<div
				className="flex items-center justify-between border-b px-4 py-2"
				style={{ borderColor: "var(--border)" }}
			>
				<h3
					className="text-sm font-medium"
					style={{ color: "var(--text-primary)" }}
				>
					Requests
				</h3>
				{noiseCount > 0 && (
					<button
						onClick={onToggleNoise}
						className="text-xs transition-colors"
						style={{
							color: showNoise ? "var(--accent)" : "var(--text-secondary)",
						}}
					>
						{showNoise
							? `Hide ${noiseCount} noise`
							: `Show ${noiseCount} noise`}
					</button>
				)}
			</div>

			<div className="flex-1 overflow-y-auto">
				{filtered.length === 0 ? (
					<div
						className="p-8 text-center text-sm"
						style={{ color: "var(--text-secondary)" }}
					>
						No requests captured yet
					</div>
				) : (
					<ul>
						{filtered.map((req) => (
							<RequestRow key={req.id} request={req} />
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

function RequestRow({ request: req }: { request: CapturedRequest }) {
	const methodStyle = METHOD_COLORS[req.method] ?? METHOD_COLORS.GET;

	return (
		<li
			className="flex items-center gap-3 border-b px-4 py-2"
			style={{
				borderColor: "var(--border)",
				opacity: req.isNoise ? 0.4 : 1,
			}}
		>
			{/* Method badge */}
			<span
				className="inline-flex w-16 shrink-0 items-center justify-center rounded px-2 py-0.5 text-xs font-semibold"
				style={{
					background: methodStyle.bg,
					color: methodStyle.text,
				}}
			>
				{req.method}
			</span>

			{/* URL */}
			<span
				className="min-w-0 flex-1 truncate font-mono text-xs"
				style={{ color: "var(--text-primary)" }}
				title={req.url}
			>
				{truncateUrl(req.url)}
			</span>

			{/* Status */}
			<span
				className="shrink-0 text-xs font-medium"
				style={{ color: statusColor(req.responseStatus ?? undefined) }}
			>
				{req.responseStatus ?? "---"}
			</span>

			{/* Duration */}
			<span
				className="w-14 shrink-0 text-right text-xs"
				style={{ color: "var(--text-secondary)" }}
			>
				{req.durationMs != null ? `${req.durationMs}ms` : ""}
			</span>

			{/* Timestamp */}
			<span
				className="w-16 shrink-0 text-right text-xs"
				style={{ color: "var(--text-secondary)" }}
			>
				{relativeTime(req.capturedAt)}
			</span>
		</li>
	);
}
