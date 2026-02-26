import { Hono } from "hono";
import { getEnv } from "@/config";

export const installRoutes = new Hono();

installRoutes.get("/slack", (c) => {
	const env = getEnv();
	const clientId = env.SLACK_CLIENT_ID;

	if (!clientId) {
		return c.text("SLACK_CLIENT_ID not configured", 500);
	}

	const scopes = [
		"app_mentions:read",
		"channels:history",
		"channels:read",
		"chat:write",
		"commands",
		"groups:history",
		"groups:read",
		"im:history",
		"im:read",
		"mpim:history",
		"mpim:read",
		"reactions:read",
		"reactions:write",
		"users:read",
	].join(",");

	const redirectUri = `${env.BASE_URL}/install/slack/callback`;
	const url = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

	return c.redirect(url);
});

installRoutes.get("/slack/callback", async (c) => {
	const env = getEnv();
	const code = c.req.query("code");

	if (!code) {
		return c.text("Missing code parameter", 400);
	}

	try {
		const response = await fetch("https://slack.com/api/oauth.v2.access", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: env.SLACK_CLIENT_ID || "",
				client_secret: env.SLACK_CLIENT_SECRET || "",
				code,
				redirect_uri: `${env.BASE_URL}/install/slack/callback`,
			}),
		});

		const data = (await response.json()) as {
			ok: boolean;
			error?: string;
			team?: { id: string; name: string };
			access_token?: string;
			bot_user_id?: string;
			authed_user?: { id: string };
		};

		if (!data.ok) {
			console.error("Slack OAuth error:", data.error);
			return c.text(`Slack OAuth failed: ${data.error}`, 400);
		}

		// TODO: Save the bot token + workspace info, then trigger onboarding DM
		console.log(`Slack bot installed to workspace: ${data.team?.name} (${data.team?.id})`);

		return c.html(`
			<html>
				<body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
					<div style="text-align: center;">
						<h1>Harvest installed!</h1>
						<p>Head back to Slack — I'll send you a DM to finish setup.</p>
					</div>
				</body>
			</html>
		`);
	} catch (err) {
		console.error("Slack OAuth exchange failed:", err);
		return c.text("OAuth exchange failed", 500);
	}
});
