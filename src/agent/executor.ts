import { AutumnError } from "autumn-js";
import type { Autumn, CustomerExpand, Range } from "autumn-js";

type ToolResult = { success: true; data: unknown } | { success: false; error: string };

function parseApiError(err: unknown): string {
	if (err instanceof AutumnError) {
		try {
			const body = JSON.parse(err.body);
			if (body.message) return body.message;
		} catch {}
	}
	if (err instanceof Error) return err.message;
	return String(err);
}

type ToolParams = Record<string, unknown>;

function str(val: unknown, fallback = ""): string {
	return typeof val === "string" ? val : fallback;
}

function num(val: unknown, fallback = 0): number {
	const n = Number(val);
	return Number.isNaN(n) ? fallback : n;
}

export async function executeTool(
	name: string,
	params: ToolParams,
	autumn: Autumn,
): Promise<ToolResult> {
	try {
		switch (name) {
			case "get_customer":
				return await getCustomer(autumn, params);
			case "list_customers":
				return await listCustomers(autumn, params);
			case "check_feature_access":
				return await checkFeatureAccess(autumn, params);
			case "get_usage_aggregate":
				return await getUsageAggregate(autumn, params);
			case "list_events":
				return await listEvents(autumn, params);
			case "list_plans":
				return await listPlans(autumn);
			case "get_plan":
				return await getPlan(autumn, params);
			case "list_features":
				return await listFeatures(autumn);
			case "get_feature":
				return await getFeature(autumn, params);
			case "get_entity":
				return await getEntity(autumn, params);
			case "get_billing_portal_url":
				return await getBillingPortalUrl(autumn, params);
			default:
				return { success: false, error: `Unknown tool: ${name}` };
		}
	} catch (err) {
		const message = parseApiError(err);
		return { success: false, error: message };
	}
}

async function getCustomer(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const data = await autumn.customers.getOrCreate({
		customerId: str(params.customer_id),
		expand: params.expand as CustomerExpand[] | undefined,
	});
	return { success: true, data };
}

async function listCustomers(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const data = await autumn.customers.list({
		limit: num(params.limit, 50),
		offset: num(params.offset, 0),
	});
	return { success: true, data };
}

async function checkFeatureAccess(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const data = await autumn.check({
		customerId: str(params.customer_id),
		featureId: str(params.feature_id),
	});
	return { success: true, data };
}

async function getUsageAggregate(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const rawFeatureId = str(params.feature_id);
	const featureIds = rawFeatureId.includes(",")
		? rawFeatureId.split(",").map((s) => s.trim())
		: rawFeatureId;

	const data = await autumn.events.aggregate({
		customerId: str(params.customer_id),
		featureId: featureIds,
		range: str(params.range, "30d") as Range,
	});
	return { success: true, data };
}

async function listEvents(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const data = await autumn.events.list({
		customerId: str(params.customer_id),
		featureId: str(params.feature_id),
		limit: num(params.limit, 20),
	});
	return { success: true, data };
}

async function listPlans(autumn: Autumn): Promise<ToolResult> {
	const data = await autumn.plans.list();
	return { success: true, data };
}

async function getPlan(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const data = await autumn.plans.get({ planId: str(params.plan_id) });
	return { success: true, data };
}

async function listFeatures(autumn: Autumn): Promise<ToolResult> {
	const data = await autumn.features.list();
	return { success: true, data };
}

async function getFeature(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const data = await autumn.features.get({ featureId: str(params.feature_id) });
	return { success: true, data };
}

async function getEntity(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const data = await autumn.entities.get({
		customerId: str(params.customer_id),
		entityId: str(params.entity_id),
	});
	return { success: true, data };
}

async function getBillingPortalUrl(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const data = await autumn.billing.openCustomerPortal({
		customerId: str(params.customer_id),
	});
	return { success: true, data };
}
