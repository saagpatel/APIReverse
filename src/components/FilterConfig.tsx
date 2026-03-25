import { useCallback, useState } from "react";
import { updateFilterConfig } from "../lib/tauri";
import type { FilterConfig as FilterConfigType, NoisePreset } from "../types";

interface FilterConfigProps {
	sessionId: string;
	config: FilterConfigType;
	onChange: (config: FilterConfigType) => void;
}

const PRESETS: { id: NoisePreset; label: string }[] = [
	{ id: "analytics", label: "Analytics" },
	{ id: "cdn", label: "CDN" },
	{ id: "social", label: "Social" },
	{ id: "fonts", label: "Fonts" },
];

export function FilterConfig({
	sessionId,
	config,
	onChange,
}: FilterConfigProps) {
	const [denyInput, setDenyInput] = useState("");
	const [allowInput, setAllowInput] = useState("");
	const [patternInput, setPatternInput] = useState("");

	const save = useCallback(
		async (newConfig: FilterConfigType) => {
			onChange(newConfig);
			await updateFilterConfig(sessionId, JSON.stringify(newConfig));
		},
		[sessionId, onChange],
	);

	const addDeny = useCallback(() => {
		const domain = denyInput.trim();
		if (!domain || config.denylist.includes(domain)) return;
		save({ ...config, denylist: [...config.denylist, domain] });
		setDenyInput("");
	}, [denyInput, config, save]);

	const removeDeny = useCallback(
		(domain: string) => {
			save({
				...config,
				denylist: config.denylist.filter((d) => d !== domain),
			});
		},
		[config, save],
	);

	const addAllow = useCallback(() => {
		const domain = allowInput.trim();
		if (!domain || config.allowlist.includes(domain)) return;
		save({ ...config, allowlist: [...config.allowlist, domain] });
		setAllowInput("");
	}, [allowInput, config, save]);

	const removeAllow = useCallback(
		(domain: string) => {
			save({
				...config,
				allowlist: config.allowlist.filter((d) => d !== domain),
			});
		},
		[config, save],
	);

	const togglePreset = useCallback(
		(preset: NoisePreset) => {
			const current = config.noisePresets;
			const next = current.includes(preset)
				? current.filter((p) => p !== preset)
				: [...current, preset];
			save({ ...config, noisePresets: next });
		},
		[config, save],
	);

	const addPattern = useCallback(() => {
		const pattern = patternInput.trim();
		if (!pattern || config.pathExcludePatterns.includes(pattern)) return;
		save({
			...config,
			pathExcludePatterns: [...config.pathExcludePatterns, pattern],
		});
		setPatternInput("");
	}, [patternInput, config, save]);

	const removePattern = useCallback(
		(pattern: string) => {
			save({
				...config,
				pathExcludePatterns: config.pathExcludePatterns.filter(
					(p) => p !== pattern,
				),
			});
		},
		[config, save],
	);

	return (
		<div className="space-y-4 px-5 py-4">
			{/* Noise Presets */}
			<div>
				<label
					className="mb-1 block text-xs uppercase tracking-wider"
					style={{ color: "var(--text-secondary)" }}
				>
					Noise Presets
				</label>
				<div className="flex gap-2">
					{PRESETS.map((p) => {
						const active = config.noisePresets.includes(p.id);
						return (
							<button
								key={p.id}
								onClick={() => togglePreset(p.id)}
								className="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
								style={{
									background: active
										? "rgba(59, 130, 246, 0.2)"
										: "var(--bg-tertiary)",
									color: active ? "#60a5fa" : "var(--text-secondary)",
								}}
							>
								{p.label}
							</button>
						);
					})}
				</div>
			</div>

			{/* Domain Denylist */}
			<div>
				<label
					className="mb-1 block text-xs uppercase tracking-wider"
					style={{ color: "var(--text-secondary)" }}
				>
					Domain Denylist
				</label>
				<div className="flex gap-2">
					<input
						value={denyInput}
						onChange={(e) => setDenyInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") addDeny();
						}}
						placeholder="e.g. sentry.io"
						className="flex-1 rounded border px-2 py-1 text-xs"
						style={{
							borderColor: "var(--border)",
							background: "var(--bg-tertiary)",
							color: "var(--text-primary)",
						}}
					/>
					<button
						onClick={addDeny}
						className="rounded px-2 py-1 text-xs"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-secondary)",
						}}
					>
						Add
					</button>
				</div>
				{config.denylist.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-1">
						{config.denylist.map((d) => (
							<Chip key={d} label={d} onRemove={() => removeDeny(d)} />
						))}
					</div>
				)}
			</div>

			{/* Domain Allowlist */}
			<div>
				<label
					className="mb-1 block text-xs uppercase tracking-wider"
					style={{ color: "var(--text-secondary)" }}
				>
					Domain Allowlist
				</label>
				<div className="flex gap-2">
					<input
						value={allowInput}
						onChange={(e) => setAllowInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") addAllow();
						}}
						placeholder="e.g. api.example.com"
						className="flex-1 rounded border px-2 py-1 text-xs"
						style={{
							borderColor: "var(--border)",
							background: "var(--bg-tertiary)",
							color: "var(--text-primary)",
						}}
					/>
					<button
						onClick={addAllow}
						className="rounded px-2 py-1 text-xs"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-secondary)",
						}}
					>
						Add
					</button>
				</div>
				{config.allowlist.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-1">
						{config.allowlist.map((d) => (
							<Chip
								key={d}
								label={d}
								onRemove={() => removeAllow(d)}
								color="#4ade80"
							/>
						))}
					</div>
				)}
			</div>

			{/* Path Exclusions */}
			<div>
				<label
					className="mb-1 block text-xs uppercase tracking-wider"
					style={{ color: "var(--text-secondary)" }}
				>
					Path Exclusion Patterns
				</label>
				<div className="flex gap-2">
					<input
						value={patternInput}
						onChange={(e) => setPatternInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") addPattern();
						}}
						placeholder="e.g. /health.*"
						className="flex-1 rounded border px-2 py-1 font-mono text-xs"
						style={{
							borderColor: "var(--border)",
							background: "var(--bg-tertiary)",
							color: "var(--text-primary)",
						}}
					/>
					<button
						onClick={addPattern}
						className="rounded px-2 py-1 text-xs"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-secondary)",
						}}
					>
						Add
					</button>
				</div>
				{config.pathExcludePatterns.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-1">
						{config.pathExcludePatterns.map((p) => (
							<Chip
								key={p}
								label={p}
								onRemove={() => removePattern(p)}
								color="#fbbf24"
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function Chip({
	label,
	onRemove,
	color = "#a3a3a3",
}: {
	label: string;
	onRemove: () => void;
	color?: string;
}) {
	return (
		<span
			className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
			style={{ background: "var(--bg-tertiary)", color }}
		>
			{label}
			<button
				onClick={onRemove}
				className="ml-0.5 opacity-60 hover:opacity-100"
			>
				x
			</button>
		</span>
	);
}
