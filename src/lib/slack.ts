import type { SlashCommandEvent } from "chat";

type SlackRawPayload = {
	team_id?: string;
	team?: {
		id?: string;
	};
	teamId?: string;
	authorizations?: Array<{
		team_id?: string;
	}>;
	user_id?: string;
};

function parseSlackRaw(raw: unknown): SlackRawPayload {
	if (!raw || typeof raw !== "object") return {};
	return raw as SlackRawPayload;
}

export function getWorkspaceId(event: SlashCommandEvent): string {
	return getWorkspaceIdFromRaw(event.raw) || "default";
}

export function getWorkspaceIdFromRaw(raw: unknown): string | null {
	const parsed = parseSlackRaw(raw);
	return (
		parsed.team_id ||
		parsed.team?.id ||
		parsed.teamId ||
		parsed.authorizations?.[0]?.team_id ||
		null
	);
}
