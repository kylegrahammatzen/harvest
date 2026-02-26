import type { SlashCommandEvent } from "chat";
import { postPrivate, postPublic } from "@/lib/command";
import { deleteWorkspace, getWorkspace } from "@/services/workspace";

export async function handleDisconnectCommand(
	event: SlashCommandEvent,
	workspaceId: string,
): Promise<void> {
	const workspace = await getWorkspace(workspaceId);

	if (!workspace) {
		await postPrivate(
			event,
			"Autumn is not configured for this workspace yet, so there is nothing to disconnect.",
		);
		return;
	}

	if (workspace.installedBy !== event.user.userId) {
		await postPrivate(
			event,
			"Only the admin who connected Autumn can disconnect it. Ask them to run `/disconnect`.",
		);
		return;
	}

	await deleteWorkspace(workspaceId);
	await postPublic(event, "Autumn has been disconnected from this workspace.");
}
