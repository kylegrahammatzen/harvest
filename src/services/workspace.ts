import { getEnv } from "@/config";
import { getRedis } from "@/lib/redis";
import { decrypt, encrypt } from "@/services/encryption";

export type WorkspaceConfig = {
	workspaceId: string;
	apiKey: string | null;
	orgSlug: string;
	orgName: string;
	commandChannels: string[];
	alertChannel: string | null;
	slackBotToken: string | null;
	webhookSecret: string | null;
	installedAt: number;
	installedBy: string;
};

const KEY_PREFIX = "autumn:workspace:";

export async function getWorkspace(workspaceId: string): Promise<WorkspaceConfig | null> {
	const redis = getRedis();
	const data = await redis.get(`${KEY_PREFIX}${workspaceId}`);
	if (!data) return null;

	const workspace = JSON.parse(data) as WorkspaceConfig;
	const encKey = getEnv().ENCRYPTION_KEY;

	if (workspace.apiKey) {
		workspace.apiKey = await decrypt(workspace.apiKey, encKey);
	}
	if (workspace.webhookSecret) {
		workspace.webhookSecret = await decrypt(workspace.webhookSecret, encKey);
	}

	return workspace;
}

export async function saveWorkspace(workspace: WorkspaceConfig): Promise<void> {
	const redis = getRedis();
	const encKey = getEnv().ENCRYPTION_KEY;

	const toStore: WorkspaceConfig = {
		...workspace,
		apiKey: workspace.apiKey ? await encrypt(workspace.apiKey, encKey) : null,
		webhookSecret: workspace.webhookSecret ? await encrypt(workspace.webhookSecret, encKey) : null,
	};

	await redis.set(`${KEY_PREFIX}${workspace.workspaceId}`, JSON.stringify(toStore));
}

export async function updateWorkspace(
	workspaceId: string,
	updates: Partial<Pick<WorkspaceConfig, "commandChannels" | "alertChannel">>,
): Promise<void> {
	const workspace = await getWorkspace(workspaceId);
	if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

	const updated = { ...workspace, ...updates };

	await saveWorkspace(updated);
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
	const redis = getRedis();
	await redis.del(`${KEY_PREFIX}${workspaceId}`);
}

export async function listWorkspaces(): Promise<string[]> {
	const redis = getRedis();
	const keys = await redis.keys(`${KEY_PREFIX}*`);
	return keys.map((k) => k.replace(KEY_PREFIX, ""));
}
