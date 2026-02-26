import { createSlackAdapter } from "@chat-adapter/slack";
import { createRedisState } from "@chat-adapter/state-redis";
import { Chat } from "chat";
import { handleCancelAction, handleConfirmAction } from "@/agent/confirm";
import { handleAgentMention, handleAgentMessage } from "@/agent/handler";
import { handleSlashCommandByName } from "@/commands/router";

export const bot = new Chat({
	userName: "autumn",
	logger: "silent",
	adapters: {
		slack: createSlackAdapter(),
	},
	state: createRedisState(),
});

bot.onSlashCommand(async (event) => {
	await handleSlashCommandByName(event);
});

bot.onNewMention(async (thread, message) => {
	await handleAgentMention(thread, message);
});

bot.onSubscribedMessage(async (thread, message) => {
	await handleAgentMessage(thread, message);
});

bot.onAction("confirm", async (event) => {
	await handleConfirmAction(event);
});

bot.onAction("cancel", async (event) => {
	await handleCancelAction(event);
});
