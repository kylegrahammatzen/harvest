import type { Autumn } from "autumn-js";
import type { AdapterPostableMessage, SlashCommandEvent } from "chat";
import { isRedisUnavailable, isSlackNotInChannel } from "@/lib/errors";
import { getWorkspaceId } from "@/lib/slack";
import { createAutumnClient } from "@/services/autumn";
import { getWorkspace, isCommandChannel } from "@/services/workspace";

export type CommandContext = {
	event: SlashCommandEvent;
	autumn: Autumn;
	args: string[];
	workspaceId: string;
};

export async function postPublic(
	event: SlashCommandEvent,
	content: AdapterPostableMessage,
): Promise<void> {
	try {
		await event.channel.post(content);
	} catch (err) {
		if (!isSlackNotInChannel(err)) throw err;
		await postPrivate(
			event,
			"Autumn is not in this channel yet. Invite Autumn to this channel and try again.",
		);
	}
}

export async function postPrivate(event: SlashCommandEvent, message: string): Promise<void> {
	await event.channel.postEphemeral(event.user, message, { fallbackToDM: true });
}

export function defineCommand(
	handler: (ctx: CommandContext) => Promise<void>,
): (event: SlashCommandEvent, args: string[]) => Promise<void> {
	return async (event, args) => {
		try {
			const workspaceId = getWorkspaceId(event);
			const workspace = await getWorkspace(workspaceId);

			if (!workspace) {
				await postPrivate(
					event,
					"Autumn is not configured for this workspace yet. Ask an admin to run `/connect`.",
				);
				return;
			}

			if (!isCommandChannel(workspace, event.channel.id)) {
				await postPrivate(
					event,
					"Autumn commands only work in configured channels. Ask an admin to add this channel in settings.",
				);
				return;
			}

			const autumn = createAutumnClient(workspace);
			await handler({ event, autumn, args, workspaceId });
		} catch (err) {
			if (isRedisUnavailable(err)) {
				await postPrivate(
					event,
					"Autumn is temporarily unavailable because Redis is offline. Try again in a minute.",
				);
				return;
			}

			if (isSlackNotInChannel(err)) {
				await postPrivate(event, "Autumn is not in this channel yet. Invite Autumn and try again.");
				return;
			}

			console.error("Command error:", err);
			await postPrivate(event, "Something went wrong running this command. Check the logs.");
		}
	};
}
