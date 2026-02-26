import Anthropic from "@anthropic-ai/sdk";
import type { Message, Thread } from "chat";
import { Actions, Button, Card, CardText as Text } from "chat";
import { executeTool } from "@/agent/executor";
import { agentTools, MUTATING_TOOLS } from "@/agent/tools";
import { getEnv } from "@/config";
import { getWorkspaceIdFromRaw } from "@/lib/slack";
import { createAutumnClient } from "@/services/autumn";
import type { WorkspaceConfig } from "@/services/workspace";
import { getWorkspace, listWorkspaces } from "@/services/workspace";

const SYSTEM_PROMPT = `You are Autumn, a billing ops assistant in Slack for Autumn (useautumn.com). You manage customers, subscriptions, usage, and billing through tools.

Rules:
- For mutating tools, write a short summary of what you'll do. Confirm/Cancel buttons appear automatically — never ask the user to confirm in text.
- For read tools, run them and present results directly.
- If a tool errors, explain clearly and suggest next steps.
- When a user refers to a customer by name or email (not an exact ID), use list_customers first and search the results by name/email to find the match. Then use the exact customer ID from the API response for any further tool calls. Never guess or construct customer IDs — always use the exact value returned by the API.
- When a user refers to a plan by name, use list_plans to find the correct plan ID before using it in mutations.
- When multiple customers match a name, list them with IDs and ask which one.
- Customers with a null external ID are normal — they were created in Autumn but haven't logged into the product yet. Their email serves as their identifier. Never suggest recreating or deleting these customers.
- If someone asks what you can do, give a brief 2-3 sentence overview, not a full list.

Formatting:
- This is Slack. Use *bold*, \`code\` for IDs/values, and • for lists.
- Always wrap email addresses in backticks like \`user@example.com\`. Slack mangles bare @ symbols into broken mentions.
- No emojis ever.
- Be concise. No filler like "Sure!", "Great question!", "I'd be happy to help!".
- When presenting customer info, only show relevant fields — skip empty or null ones.`;

let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
	if (!_anthropic) {
		const apiKey = getEnv().ANTHROPIC_API_KEY;
		if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
		_anthropic = new Anthropic({ apiKey });
	}
	return _anthropic;
}

async function resolveWorkspaceId(raw: unknown): Promise<string | null> {
	const explicitWorkspaceId = getWorkspaceIdFromRaw(raw);
	if (explicitWorkspaceId) return explicitWorkspaceId;

	const workspaceIds = await listWorkspaces();
	if (workspaceIds.length === 1) return workspaceIds[0];
	return null;
}

export async function handleAgentMention(thread: Thread, message: Message): Promise<void> {
	if (thread.isDM) {
		await thread.post("DMs aren't supported yet, mention me in a channel instead.");
		return;
	}

	const workspaceId = await resolveWorkspaceId(message.raw);
	const workspace = workspaceId ? await getWorkspace(workspaceId) : null;

	await thread.subscribe();

	if (!workspace) {
		await thread.post("Ask an admin to run `/connect` to set up Autumn for this workspace.");
		return;
	}

	if (!workspace.apiKey) {
		await thread.post(
			"This workspace isn't connected to Autumn yet, run `/connect` to get started.",
		);
		return;
	}

	if (
		workspace.commandChannels.length > 0 &&
		thread.channelId &&
		!workspace.commandChannels.includes(thread.channelId)
	) {
		await thread.post("Autumn isn't enabled in this channel, ask an admin to add it in settings.");
		return;
	}

	await runAgentLoop(thread, message);
}

export async function handleAgentMessage(thread: Thread, message: Message): Promise<void> {
	if (thread.isDM) return;

	const workspaceId = await resolveWorkspaceId(message.raw);
	const workspace = workspaceId ? await getWorkspace(workspaceId) : null;

	if (!workspace?.apiKey) {
		await thread.post("Run `/connect` to set up Autumn first.");
		return;
	}

	if (
		workspace.commandChannels.length > 0 &&
		thread.channelId &&
		!workspace.commandChannels.includes(thread.channelId)
	)
		return;

	await runAgentLoop(thread, message);
}

const MAX_HISTORY = 20;
const SUMMARIZE_THRESHOLD = 10;

async function buildMessages(
	thread: Thread,
	message: Message,
	anthropic: Anthropic,
): Promise<Anthropic.MessageParam[]> {
	const history: { role: "user" | "assistant"; content: string }[] = [];

	for await (const msg of thread.allMessages) {
		if (!msg.text.trim()) continue;
		history.push({
			role: msg.author.isMe ? "assistant" : "user",
			content: msg.text,
		});
		if (history.length >= MAX_HISTORY) break;
	}

	if (history.length <= 1) {
		return [{ role: "user", content: message.text }];
	}

	if (history.length > SUMMARIZE_THRESHOLD) {
		const older = history.slice(0, -3);
		const recent = history.slice(-3);
		const transcript = older.map((m) => `${m.role}: ${m.content}`).join("\n");

		const summary = await anthropic.messages.create({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 512,
			messages: [
				{
					role: "user",
					content: `Summarize this conversation in 2-3 sentences. Preserve all exact customer IDs, plan IDs, and email addresses mentioned. Focus on what was discussed and any pending requests:\n\n${transcript}`,
				},
			],
		});

		const summaryText = summary.content
			.filter((b): b is Anthropic.TextBlock => b.type === "text")
			.map((b) => b.text)
			.join("");

		return [
			{ role: "user", content: `[Previous conversation summary: ${summaryText}]` },
			{
				role: "assistant",
				content: "Understood, I have the context from our previous conversation.",
			},
			...recent,
		];
	}

	return history;
}

type PendingMutation = {
	toolName: string;
	toolInput: Record<string, unknown>;
};

export async function runAgentWithContext(
	thread: Thread<unknown>,
	raw: unknown,
	text: string,
): Promise<void> {
	const workspaceId = await resolveWorkspaceId(raw);
	if (!workspaceId) return;

	const workspace = await getWorkspace(workspaceId);
	if (!workspace?.apiKey) return;

	console.log(`Agent (recovery): "${text.slice(0, 80)}" (${workspace.orgName})`);
	await runAgentLoopInner(thread, workspace, [{ role: "user", content: text }]);
}

async function runAgentLoop(thread: Thread, message: Message): Promise<void> {
	const workspaceId = await resolveWorkspaceId(message.raw);
	if (!workspaceId) return;

	const workspace = await getWorkspace(workspaceId);
	if (!workspace) return;

	const text = message.text.length > 80 ? `${message.text.slice(0, 80)}...` : message.text;
	console.log(`Agent: "${text}" (${workspace.orgName})`);

	const anthropic = getAnthropic();
	const messages = await buildMessages(thread, message, anthropic);
	await runAgentLoopInner(thread, workspace, messages);
}

async function runAgentLoopInner(
	thread: Thread<unknown>,
	workspace: WorkspaceConfig,
	messages: Anthropic.MessageParam[],
): Promise<void> {
	try {
		const autumn = createAutumnClient(workspace);
		const anthropic = getAnthropic();

		await thread.startTyping().catch(() => {});

		let pendingMutation: PendingMutation | null = null;

		let response = await anthropic.messages.create({
			model: "claude-sonnet-4-20250514",
			max_tokens: 4096,
			system: SYSTEM_PROMPT,
			tools: agentTools,
			messages,
		});

		while (response.stop_reason === "tool_use") {
			const toolUseBlocks = response.content.filter(
				(b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
			);

			const toolResults: Anthropic.ToolResultBlockParam[] = [];

			for (const toolUse of toolUseBlocks) {
				if (MUTATING_TOOLS.has(toolUse.name)) {
					pendingMutation = {
						toolName: toolUse.name,
						toolInput: toolUse.input as Record<string, unknown>,
					};
					toolResults.push({
						type: "tool_result",
						tool_use_id: toolUse.id,
						content: JSON.stringify({
							status: "confirmation_required",
							message:
								"This is a mutating action. Describe what you're about to do clearly and concisely. Confirm/Cancel buttons will appear automatically after your message.",
							tool_name: toolUse.name,
							params: toolUse.input,
						}),
					});
				} else {
					const result = await executeTool(
						toolUse.name,
						toolUse.input as Record<string, unknown>,
						autumn,
					);
					toolResults.push({
						type: "tool_result",
						tool_use_id: toolUse.id,
						content: JSON.stringify(result),
					});
				}
			}

			messages.push({ role: "assistant", content: response.content });
			messages.push({ role: "user", content: toolResults });

			response = await anthropic.messages.create({
				model: "claude-sonnet-4-20250514",
				max_tokens: 4096,
				system: SYSTEM_PROMPT,
				tools: agentTools,
				messages,
			});
		}

		const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
		const responseText = textBlocks.map((b) => b.text).join("\n");

		if (responseText && pendingMutation) {
			await thread.post(
				Card({
					children: [
						Text(responseText),
						Actions([
							Button({
								id: "confirm",
								label: "Confirm",
								style: "primary",
								value: JSON.stringify({
									action: pendingMutation.toolName,
									...pendingMutation.toolInput,
								}),
							}),
							Button({ id: "cancel", label: "Cancel", style: "danger" }),
						]),
					],
				}),
			);
		} else if (responseText) {
			await thread.post({ markdown: responseText });
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("Agent loop failed", {
			error: message,
			org: workspace.orgName,
			thread: thread.id,
		});
		await thread.post("Something went wrong, try again later.");
	}
}
