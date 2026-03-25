import { useCallback, useState } from "react";
import type { Session } from "../types";

interface SessionManagerProps {
	sessions: Session[];
	activeSessionId: string | null;
	onSelect: (session: Session) => void;
	onRename: (sessionId: string, name: string) => void;
	onDelete: (sessionId: string) => void;
	onClose: () => void;
}

const MODE_BADGES: Record<string, { background: string; color: string }> = {
	extension: { background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" },
	mitm: { background: "rgba(168, 85, 247, 0.15)", color: "#c084fc" },
	mixed: { background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" },
};

const STATUS_STYLES: Record<string, { background: string; color: string }> = {
	active: { background: "rgba(34, 197, 94, 0.15)", color: "#4ade80" },
	complete: { background: "rgba(163, 163, 163, 0.15)", color: "#a3a3a3" },
	archived: { background: "rgba(163, 163, 163, 0.1)", color: "#737373" },
};

export function SessionManager({
	sessions,
	activeSessionId,
	onSelect,
	onRename,
	onDelete,
	onClose,
}: SessionManagerProps) {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

	const startRename = useCallback((session: Session) => {
		setEditingId(session.id);
		setEditName(session.name);
	}, []);

	const commitRename = useCallback(() => {
		if (editingId && editName.trim()) {
			onRename(editingId, editName.trim());
		}
		setEditingId(null);
	}, [editingId, editName, onRename]);

	const confirmDelete = useCallback(
		(sessionId: string) => {
			onDelete(sessionId);
			setConfirmDeleteId(null);
		},
		[onDelete],
	);

	return (
		<div
			className="flex h-full w-72 flex-col border-r"
			style={{
				borderColor: "var(--border)",
				background: "var(--bg-secondary)",
			}}
		>
			<div
				className="flex items-center justify-between border-b px-4 py-3"
				style={{ borderColor: "var(--border)" }}
			>
				<h3
					className="text-sm font-medium"
					style={{ color: "var(--text-primary)" }}
				>
					Sessions
				</h3>
				<button
					onClick={onClose}
					className="text-xs"
					style={{ color: "var(--text-secondary)" }}
				>
					Close
				</button>
			</div>

			<div className="flex-1 overflow-y-auto">
				{sessions.map((s) => (
					<div
						key={s.id}
						className="border-b px-4 py-3"
						style={{
							borderColor: "var(--border)",
							background:
								s.id === activeSessionId ? "var(--bg-tertiary)" : "transparent",
						}}
					>
						{/* Name */}
						{editingId === s.id ? (
							<input
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								onBlur={commitRename}
								onKeyDown={(e) => {
									if (e.key === "Enter") commitRename();
									if (e.key === "Escape") setEditingId(null);
								}}
								autoFocus
								className="mb-1 w-full rounded border px-1 text-sm"
								style={{
									borderColor: "var(--border)",
									background: "var(--bg-primary)",
									color: "var(--text-primary)",
								}}
							/>
						) : (
							<button
								onClick={() => onSelect(s)}
								onDoubleClick={() => startRename(s)}
								className="mb-1 block w-full truncate text-left text-sm font-medium"
								style={{ color: "var(--text-primary)" }}
								title="Click to open, double-click to rename"
							>
								{s.name}
							</button>
						)}

						{/* Meta row */}
						<div className="flex items-center gap-2">
							<span
								className="rounded px-1.5 py-0.5 text-[10px] uppercase"
								style={MODE_BADGES[s.captureMode] ?? MODE_BADGES.extension}
							>
								{s.captureMode}
							</span>
							<span
								className="text-[10px]"
								style={{ color: "var(--text-secondary)" }}
							>
								{s.requestCount} req
							</span>
							<span
								className="rounded-full px-1.5 py-0.5 text-[10px]"
								style={STATUS_STYLES[s.status] ?? STATUS_STYLES.complete}
							>
								{s.status}
							</span>
						</div>

						{/* Actions */}
						<div className="mt-2 flex gap-2">
							<button
								onClick={() => startRename(s)}
								className="text-[10px]"
								style={{ color: "var(--text-secondary)" }}
							>
								Rename
							</button>
							{confirmDeleteId === s.id ? (
								<>
									<button
										onClick={() => confirmDelete(s.id)}
										className="text-[10px] font-medium"
										style={{ color: "#f87171" }}
									>
										Confirm Delete
									</button>
									<button
										onClick={() => setConfirmDeleteId(null)}
										className="text-[10px]"
										style={{ color: "var(--text-secondary)" }}
									>
										Cancel
									</button>
								</>
							) : (
								<button
									onClick={() => setConfirmDeleteId(s.id)}
									className="text-[10px]"
									style={{ color: "#f87171" }}
								>
									Delete
								</button>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
