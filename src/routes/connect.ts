import type { Context } from "hono";
import { Hono } from "hono";
import { getEnv } from "@/config";
import { getRedis } from "@/lib/redis";
import { getWorkspace, saveWorkspace } from "@/services/workspace";

export const connectRoutes = new Hono();

type WorkspaceEnvironment = "sandbox" | "live";

type OAuthStatePayload = {
	workspaceId: string;
	userId: string;
	environment: WorkspaceEnvironment;
	codeVerifier: string;
	createdAt: number;
};

type TokenResponse = {
	access_token?: string;
	token_type?: string;
	expires_in?: number;
	refresh_token?: string;
	error?: string;
	error_description?: string;
};

type ApiKeysResponse = {
	sandbox_key?: string;
	prod_key?: string;
	org_id?: string;
	org_name?: string;
	error?: string;
};

const OAUTH_SCOPE = [
	"customers:create",
	"customers:read",
	"customers:list",
	"customers:update",
	"customers:delete",
	"features:create",
	"features:read",
	"features:list",
	"features:update",
	"features:delete",
	"plans:create",
	"plans:read",
	"plans:list",
	"plans:update",
	"plans:delete",
	"apiKeys:create",
	"apiKeys:read",
	"organisation:read",
].join(" ");

const OAUTH_KEY_PREFIX = "autumn:oauth:state:";

function normalizeEnvironment(value: string | undefined): WorkspaceEnvironment {
	return value === "live" ? "live" : "sandbox";
}

function randomBase64Url(bytes: number): string {
	const arr = new Uint8Array(bytes);
	crypto.getRandomValues(arr);
	return toBase64Url(arr);
}

function toBase64Url(data: Uint8Array): string {
	return Buffer.from(data)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

async function sha256Base64Url(input: string): Promise<string> {
	const bytes = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return toBase64Url(new Uint8Array(digest));
}

function renderHtml(title: string, message: string): string {
	return `
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="font-family: system-ui; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f7f5; color: #171717;">
  <main style="max-width: 560px; padding: 24px; text-align: center; background: white; border: 1px solid #e7e5e4; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.04);">
    <h1 style="margin: 0 0 12px; font-size: 24px;">${title}</h1>
    <p style="margin: 0; line-height: 1.5;">${message}</p>
  </main>
</body>
</html>
`;
}

function getOAuthRedirectUri(): string {
	return `${getEnv().BASE_URL}/`;
}

connectRoutes.get("/", async (c) => {
	const env = getEnv();
	const workspaceId = c.req.query("workspace_id")?.trim();
	const userId = c.req.query("user_id")?.trim();
	const environment = normalizeEnvironment(c.req.query("env"));

	if (!workspaceId || !userId) {
		return c.html(
			renderHtml(
				"Missing Parameters",
				"Expected workspace_id and user_id in the URL. Please run /connect from Slack again.",
			),
			400,
		);
	}

	const state = randomBase64Url(24);
	const codeVerifier = randomBase64Url(48);
	const codeChallenge = await sha256Base64Url(codeVerifier);
	const redirectUri = getOAuthRedirectUri();

	const statePayload: OAuthStatePayload = {
		workspaceId,
		userId,
		environment,
		codeVerifier,
		createdAt: Date.now(),
	};

	await getRedis().setex(`${OAUTH_KEY_PREFIX}${state}`, 10 * 60, JSON.stringify(statePayload));

	const authorizeUrl = new URL(`${env.AUTUMN_BACKEND_URL}/api/auth/oauth2/authorize`);
	authorizeUrl.searchParams.set("response_type", "code");
	authorizeUrl.searchParams.set("client_id", env.AUTUMN_OAUTH_CLIENT_ID);
	authorizeUrl.searchParams.set("redirect_uri", redirectUri);
	authorizeUrl.searchParams.set("state", state);
	authorizeUrl.searchParams.set("code_challenge", codeChallenge);
	authorizeUrl.searchParams.set("code_challenge_method", "S256");
	authorizeUrl.searchParams.set("scope", OAUTH_SCOPE);
	authorizeUrl.searchParams.set("prompt", "consent");

	return c.redirect(authorizeUrl.toString());
});

export async function handleOAuthCallback(c: Context): Promise<Response> {
	const env = getEnv();
	const code = c.req.query("code");
	const state = c.req.query("state");
	const oauthError = c.req.query("error");
	const oauthErrorDescription = c.req.query("error_description");

	if (oauthError) {
		return c.html(
			renderHtml("Autumn Authorization Failed", oauthErrorDescription || oauthError),
			400,
		);
	}

	if (!code || !state) {
		return c.html(
			renderHtml("Invalid Callback", "Missing code or state. Please run /connect again."),
			400,
		);
	}

	const redis = getRedis();
	const stateKey = `${OAUTH_KEY_PREFIX}${state}`;
	const rawState = await redis.get(stateKey);
	await redis.del(stateKey);

	if (!rawState) {
		return c.html(
			renderHtml("Session Expired", "This connect session expired. Please run /connect again."),
			400,
		);
	}

	let statePayload: OAuthStatePayload;
	try {
		statePayload = JSON.parse(rawState) as OAuthStatePayload;
	} catch {
		return c.html(
			renderHtml(
				"Invalid Session",
				"Could not read the saved connect session. Please run /connect again.",
			),
			400,
		);
	}

	const redirectUri = getOAuthRedirectUri();

	const tokenResponse = await fetch(`${env.AUTUMN_BACKEND_URL}/api/auth/oauth2/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: redirectUri,
			client_id: env.AUTUMN_OAUTH_CLIENT_ID,
			code_verifier: statePayload.codeVerifier,
		}),
	});

	if (!tokenResponse.ok) {
		const tokenError = (await tokenResponse.json().catch(() => ({}))) as TokenResponse;
		return c.html(
			renderHtml(
				"Token Exchange Failed",
				tokenError.error_description || tokenError.error || "Could not exchange OAuth code.",
			),
			400,
		);
	}

	const tokens = (await tokenResponse.json()) as TokenResponse;
	if (!tokens.access_token) {
		return c.html(
			renderHtml("Token Exchange Failed", "No access token returned by Autumn OAuth."),
			400,
		);
	}

	const apiKeysResponse = await fetch(`${env.AUTUMN_BACKEND_URL}/cli/api-keys`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${tokens.access_token}`,
			"Content-Type": "application/json",
		},
	});

	if (!apiKeysResponse.ok) {
		const keyError = (await apiKeysResponse.json().catch(() => ({}))) as ApiKeysResponse;
		return c.html(
			renderHtml(
				"API Key Provisioning Failed",
				keyError.error || "Autumn OAuth succeeded, but key provisioning failed.",
			),
			400,
		);
	}

	const apiKeys = (await apiKeysResponse.json()) as ApiKeysResponse;
	const autumnApiKey = statePayload.environment === "live" ? apiKeys.prod_key : apiKeys.sandbox_key;

	if (!autumnApiKey || !apiKeys.org_id) {
		return c.html(
			renderHtml(
				"Incomplete Key Response",
				"Autumn returned an incomplete key payload. Please try again.",
			),
			400,
		);
	}

	const existing = await getWorkspace(statePayload.workspaceId);

	await saveWorkspace({
		workspaceId: statePayload.workspaceId,
		autumnApiKey,
		environment: statePayload.environment,
		orgSlug: apiKeys.org_id,
		orgName: apiKeys.org_name || existing?.orgName || apiKeys.org_id,
		commandChannels: existing?.commandChannels || [],
		alertChannel: existing?.alertChannel || null,
		slackBotToken: existing?.slackBotToken || null,
		installedAt: existing?.installedAt || Date.now(),
		installedBy: statePayload.userId,
	});

	return c.html(
		renderHtml(
			"Autumn Connected",
			"Autumn is now connected. Return to Slack and run /customer <id>.",
		),
		200,
	);
}

connectRoutes.get("/callback", handleOAuthCallback);
