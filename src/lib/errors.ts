type AppError = {
	code?: string;
	message?: string;
	data?: {
		error?: string;
	};
};

function coerceError(err: unknown): AppError {
	if (!err || typeof err !== "object") return {};
	return err as AppError;
}

export function isRedisUnavailable(err: unknown): boolean {
	const e = coerceError(err);
	return (
		e.code === "ECONNREFUSED" ||
		(typeof e.message === "string" && e.message.includes("ECONNREFUSED"))
	);
}

export function isSlackNotInChannel(err: unknown): boolean {
	const e = coerceError(err);
	return e.code === "slack_webapi_platform_error" && e.data?.error === "not_in_channel";
}
