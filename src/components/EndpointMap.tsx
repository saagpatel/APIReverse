import { useState } from "react";
import type { Endpoint } from "../types";

interface EndpointMapProps {
	endpoints: Endpoint[];
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

function authIcon(
	auth: string | undefined,
): { label: string; icon: string } | null {
	switch (auth) {
		case "bearer":
			return { label: "Bearer token", icon: "\u{1F512}" };
		case "basic":
			return { label: "Basic auth", icon: "\u{1F512}" };
		case "apikey":
			return { label: "API key", icon: "\u{1F511}" };
		case "cookie":
			return { label: "Cookie auth", icon: "\u{1F36A}" };
		default:
			return null;
	}
}

type GroupedEndpoints = Map<string, Endpoint[]>;

function groupByHost(endpoints: Endpoint[]): GroupedEndpoints {
	const groups = new Map<string, Endpoint[]>();
	for (const ep of endpoints) {
		const existing = groups.get(ep.host);
		if (existing) {
			existing.push(ep);
		} else {
			groups.set(ep.host, [ep]);
		}
	}
	return groups;
}

export function EndpointMap({ endpoints }: EndpointMapProps) {
	const grouped = groupByHost(endpoints);
	const [expandedHost, setExpandedHost] = useState<string | null>(null);

	return (
		<div className="flex h-full flex-col">
			<div
				className="border-b px-4 py-2"
				style={{ borderColor: "var(--border)" }}
			>
				<h3
					className="text-sm font-medium"
					style={{ color: "var(--text-primary)" }}
				>
					Endpoints
				</h3>
			</div>

			<div className="flex-1 overflow-y-auto">
				{endpoints.length === 0 ? (
					<div
						className="p-8 text-center text-sm"
						style={{ color: "var(--text-secondary)" }}
					>
						No endpoints detected yet
					</div>
				) : (
					<div>
						{[...grouped.entries()].map(([host, eps]) => (
							<HostGroup
								key={host}
								host={host}
								endpoints={eps}
								expanded={expandedHost === host}
								onToggle={() =>
									setExpandedHost(expandedHost === host ? null : host)
								}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function HostGroup({
	host,
	endpoints,
	expanded,
	onToggle,
}: {
	host: string;
	endpoints: Endpoint[];
	expanded: boolean;
	onToggle: () => void;
}) {
	const totalRequests = endpoints.reduce((sum, ep) => sum + ep.requestCount, 0);

	return (
		<div>
			<button
				onClick={onToggle}
				className="flex w-full items-center justify-between border-b px-4 py-2 text-left transition-colors hover:bg-white/5"
				style={{ borderColor: "var(--border)" }}
			>
				<span
					className="text-xs font-medium"
					style={{ color: "var(--text-primary)" }}
				>
					{host}
				</span>
				<div className="flex items-center gap-2">
					<span className="text-xs" style={{ color: "var(--text-secondary)" }}>
						{endpoints.length} endpoints &middot; {totalRequests} requests
					</span>
					<span className="text-xs" style={{ color: "var(--text-secondary)" }}>
						{expanded ? "\u25B4" : "\u25BE"}
					</span>
				</div>
			</button>

			{expanded && (
				<ul>
					{endpoints
						.sort((a, b) => b.requestCount - a.requestCount)
						.map((ep) => (
							<EndpointRow key={ep.id} endpoint={ep} />
						))}
				</ul>
			)}
		</div>
	);
}

function EndpointRow({ endpoint: ep }: { endpoint: Endpoint }) {
	const methodStyle = METHOD_COLORS[ep.method] ?? METHOD_COLORS.GET;
	const auth = authIcon(ep.authDetected ?? undefined);

	return (
		<li
			className="flex items-center gap-3 border-b px-4 py-2 pl-8"
			style={{ borderColor: "var(--border)" }}
		>
			{/* Method badge */}
			<span
				className="inline-flex w-16 shrink-0 items-center justify-center rounded px-2 py-0.5 text-xs font-semibold"
				style={{
					background: methodStyle.bg,
					color: methodStyle.text,
				}}
			>
				{ep.method}
			</span>

			{/* Path */}
			<span
				className="min-w-0 flex-1 truncate font-mono text-xs"
				style={{ color: "var(--text-primary)" }}
				title={ep.normalizedPath}
			>
				{ep.normalizedPath}
			</span>

			{/* Auth icon */}
			{auth && (
				<span className="shrink-0 text-xs" title={auth.label}>
					{auth.icon}
				</span>
			)}

			{/* Request count badge */}
			<span
				className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
				style={{
					background: "rgba(163, 163, 163, 0.15)",
					color: "var(--text-secondary)",
				}}
			>
				{ep.requestCount}
			</span>
		</li>
	);
}
