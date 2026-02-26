import type { SlashCommandEvent } from "chat";
import { balanceCommand } from "@/commands/balance";
import { checkoutCommand } from "@/commands/checkout";
import { handleConnectCommand } from "@/commands/connect";
import { customerCommand } from "@/commands/customer";
import { handleDisconnectCommand } from "@/commands/disconnect";
import { renewalsCommand } from "@/commands/renewals";
import { usageCommand } from "@/commands/usage";
import { postPrivate } from "@/lib/command";
import { isRedisUnavailable, isSlackNotInChannel } from "@/lib/errors";
import { getWorkspaceId } from "@/lib/slack";

function parseArgs(text: string): string[] {
	const trimmed = (text || "").trim();
	if (!trimmed) return [];
	return trimmed.split(/\s+/);
}

async function wrapSimpleCommand(
	event: SlashCommandEvent,
	handler: (event: SlashCommandEvent, workspaceId: string) => Promise<void>,
): Promise<void> {
	try {
		const workspaceId = getWorkspaceId(event);
		await handler(event, workspaceId);
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
}

export async function handleSlashCommandByName(event: SlashCommandEvent): Promise<void> {
	const command = (event.command || "").toLowerCase();
	const args = parseArgs(event.text || "");

	switch (command) {
		case "/connect":
			return wrapSimpleCommand(event, handleConnectCommand);
		case "/disconnect":
			return wrapSimpleCommand(event, handleDisconnectCommand);
		case "/customer":
			return customerCommand(event, args);
		case "/usage":
			return usageCommand(event, args);
		case "/balance":
			return balanceCommand(event, args);
		case "/checkout":
			return checkoutCommand(event, args);
		case "/renewals":
			return renewalsCommand(event, args);
		default:
			await postPrivate(event, `Unknown command: \`${command}\`.`);
	}
}
