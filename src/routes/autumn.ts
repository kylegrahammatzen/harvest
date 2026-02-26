import { Hono } from "hono";
import { routeAutumnEvent } from "@/alerts/router";

export const autumnWebhookRoutes = new Hono();

autumnWebhookRoutes.post("/", async (c) => {
	const svixId = c.req.header("svix-id");
	const svixTimestamp = c.req.header("svix-timestamp");
	const svixSignature = c.req.header("svix-signature");

	if (!svixId || !svixTimestamp || !svixSignature) {
		return c.text("Missing Svix headers", 400);
	}

	const body = await c.req.text();

	// TODO: per-workspace Svix secret lookup

	try {
		const payload = JSON.parse(body);

		// Route to the appropriate alert handler
		await routeAutumnEvent(payload);

		return c.text("OK", 200);
	} catch (err) {
		console.error("Failed to process Autumn webhook:", err);
		return c.text("Webhook processing failed", 400);
	}
});
