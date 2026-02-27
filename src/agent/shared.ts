import { AutumnError } from "autumn-js";

export function parseApiError(err: unknown): string {
	if (err instanceof AutumnError) {
		try {
			const body = JSON.parse(err.body);
			if (body.message) return body.message;
		} catch {}
	}
	if (err instanceof Error) return err.message;
	return String(err);
}

export function str(val: unknown, fallback = ""): string {
	return typeof val === "string" ? val : fallback;
}

export function num(val: unknown, fallback = 0): number {
	const n = Number(val);
	return Number.isNaN(n) ? fallback : n;
}
