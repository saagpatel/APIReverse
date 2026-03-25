import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useCallback, useMemo, useState } from "react";
import {
	buildPostmanCollection,
	collectionToJson,
} from "../lib/postman-builder";
import type { Endpoint, InferenceResult } from "../types";

interface CollectionPreviewProps {
	sessionName: string;
	endpoints: Endpoint[];
	results: InferenceResult[];
}

const METHOD_COLORS: Record<string, string> = {
	GET: "#60a5fa",
	POST: "#4ade80",
	PUT: "#fbbf24",
	PATCH: "#c084fc",
	DELETE: "#f87171",
};

export function CollectionPreview({
	sessionName,
	endpoints,
	results,
}: CollectionPreviewProps) {
	const [exporting, setExporting] = useState(false);
	const [exportResult, setExportResult] = useState<string | null>(null);

	const collection = useMemo(
		() => buildPostmanCollection(sessionName, endpoints, results),
		[sessionName, endpoints, results],
	);

	const handleExport = useCallback(async () => {
		setExporting(true);
		setExportResult(null);
		try {
			const json = collectionToJson(collection);
			const path = await save({
				defaultPath: `${sessionName.replace(/[^a-zA-Z0-9]/g, "_")}.postman_collection.json`,
				filters: [{ name: "Postman Collection", extensions: ["json"] }],
			});
			if (path) {
				await writeTextFile(path, json);
				setExportResult(path);
			}
		} catch (e: unknown) {
			console.error("Export failed:", e);
		} finally {
			setExporting(false);
		}
	}, [collection, sessionName]);

	if (results.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-center">
					<p
						className="text-lg font-light"
						style={{ color: "var(--text-secondary)" }}
					>
						No inference results yet
					</p>
					<p
						className="mt-2 text-sm"
						style={{ color: "var(--text-secondary)" }}
					>
						Run AI Analysis first to generate the collection
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div
				className="flex items-center justify-between border-b px-5 py-3"
				style={{ borderColor: "var(--border)" }}
			>
				<div>
					<h3
						className="text-sm font-medium"
						style={{ color: "var(--text-primary)" }}
					>
						{collection.info.name}
					</h3>
					<p className="text-xs" style={{ color: "var(--text-secondary)" }}>
						{endpoints.length} endpoints &middot; {results.length} analyzed
					</p>
				</div>
				<button
					onClick={handleExport}
					disabled={exporting}
					className="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
					style={{ background: "var(--accent)", color: "#fff" }}
				>
					{exporting ? "Exporting..." : "Export Collection"}
				</button>
			</div>

			{exportResult && (
				<div
					className="border-b px-5 py-2 text-xs"
					style={{
						borderColor: "var(--border)",
						background: "rgba(34, 197, 94, 0.05)",
						color: "#4ade80",
					}}
				>
					Exported to {exportResult}
				</div>
			)}

			{/* Collection tree */}
			<div className="flex-1 overflow-y-auto">
				{collection.item.map((folder) => (
					<FolderItem key={folder.name} folder={folder} />
				))}
			</div>

			{/* Variables */}
			<div
				className="border-t px-5 py-3"
				style={{ borderColor: "var(--border)" }}
			>
				<p
					className="mb-2 text-xs uppercase tracking-wider"
					style={{ color: "var(--text-secondary)" }}
				>
					Collection Variables
				</p>
				<div className="flex flex-wrap gap-2">
					{collection.variable.map((v) => (
						<span
							key={v.key}
							className="rounded px-2 py-0.5 font-mono text-xs"
							style={{
								background: "var(--bg-tertiary)",
								color: "var(--text-secondary)",
							}}
						>
							{"{{"}
							{v.key}
							{"}}"}
						</span>
					))}
				</div>
			</div>
		</div>
	);
}

function FolderItem({
	folder,
}: {
	folder: {
		name: string;
		item: {
			name: string;
			request: { method: string; url: { raw: string }; description?: string };
		}[];
	};
}) {
	const [expanded, setExpanded] = useState(true);

	return (
		<div>
			<button
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center gap-2 border-b px-5 py-2 text-left hover:bg-white/5"
				style={{ borderColor: "var(--border)" }}
			>
				<span className="text-xs" style={{ color: "var(--text-secondary)" }}>
					{expanded ? "\u25BE" : "\u25B8"}
				</span>
				<span
					className="text-xs font-medium"
					style={{ color: "var(--text-primary)" }}
				>
					{folder.name}
				</span>
				<span className="text-xs" style={{ color: "var(--text-secondary)" }}>
					({folder.item.length})
				</span>
			</button>

			{expanded &&
				folder.item.map((item, i) => (
					<div
						key={i}
						className="border-b py-2 pl-10 pr-5"
						style={{ borderColor: "var(--border)" }}
					>
						<div className="flex items-center gap-2">
							<span
								className="text-xs font-semibold"
								style={{
									color:
										METHOD_COLORS[item.request.method] ??
										"var(--text-secondary)",
								}}
							>
								{item.request.method}
							</span>
							<span
								className="font-mono text-xs"
								style={{ color: "var(--text-primary)" }}
							>
								{item.request.url.raw}
							</span>
						</div>
						<p className="text-xs" style={{ color: "var(--text-primary)" }}>
							{item.name}
						</p>
						{item.request.description && (
							<p
								className="mt-0.5 text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								{item.request.description}
							</p>
						)}
					</div>
				))}
		</div>
	);
}
