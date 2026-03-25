import { useCallback, useEffect, useState } from "react";
import { getCaStatus, installCa } from "../lib/tauri";

type CaState =
	| "checking"
	| "not-installed"
	| "installing"
	| "installed"
	| "error";

interface CASetupModalProps {
	open: boolean;
	onClose: () => void;
	onInstalled: () => void;
}

export function CASetupModal({
	open,
	onClose,
	onInstalled,
}: CASetupModalProps) {
	const [state, setState] = useState<CaState>("checking");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setState("checking");
		getCaStatus()
			.then((status) => {
				if (status.trusted) {
					setState("installed");
				} else {
					setState("not-installed");
				}
			})
			.catch((e: unknown) => {
				setError(String(e));
				setState("error");
			});
	}, [open]);

	const handleInstall = useCallback(async () => {
		setState("installing");
		setError(null);
		try {
			await installCa();
			setState("installed");
			onInstalled();
		} catch (e: unknown) {
			setError(String(e));
			setState("error");
		}
	}, [onInstalled]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center"
			style={{ background: "rgba(0, 0, 0, 0.7)" }}
		>
			<div
				className="w-full max-w-md rounded-xl border p-6"
				style={{
					background: "var(--bg-secondary)",
					borderColor: "var(--border)",
				}}
			>
				<h2
					className="mb-4 text-lg font-medium"
					style={{ color: "var(--text-primary)" }}
				>
					HTTPS Interception Setup
				</h2>

				<div className="mb-6 space-y-3">
					<p className="text-sm" style={{ color: "var(--text-secondary)" }}>
						APIspy needs to install a local CA certificate to intercept HTTPS
						traffic through the MITM proxy.
					</p>
					<p className="text-sm" style={{ color: "var(--text-secondary)" }}>
						This certificate is generated locally and never leaves your machine.
						It allows APIspy to decrypt HTTPS traffic flowing through the proxy
						on port 8877.
					</p>
					<div
						className="rounded-lg border px-3 py-2 text-xs"
						style={{
							borderColor: "rgba(245, 158, 11, 0.3)",
							background: "rgba(245, 158, 11, 0.08)",
							color: "#fbbf24",
						}}
					>
						You can remove this certificate at any time via Keychain Access. The
						certificate is only valid for this machine.
					</div>
				</div>

				{error && (
					<div
						className="mb-4 rounded-lg border px-3 py-2 text-sm"
						style={{
							borderColor: "#dc2626",
							background: "rgba(220, 38, 38, 0.1)",
							color: "#fca5a5",
						}}
					>
						{error}
					</div>
				)}

				<div className="flex items-center justify-end gap-3">
					<button
						onClick={onClose}
						className="rounded-lg px-4 py-2 text-sm transition-colors"
						style={{ color: "var(--text-secondary)" }}
					>
						Skip
					</button>

					{state === "installed" ? (
						<button
							onClick={onClose}
							className="rounded-lg px-4 py-2 text-sm font-medium"
							style={{
								background: "rgba(34, 197, 94, 0.15)",
								color: "#4ade80",
							}}
						>
							CA Installed
						</button>
					) : (
						<button
							onClick={handleInstall}
							disabled={state === "installing" || state === "checking"}
							className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
							style={{
								background: "var(--accent)",
								color: "#fff",
							}}
						>
							{state === "installing"
								? "Installing..."
								: state === "checking"
									? "Checking..."
									: "Install CA Certificate"}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
