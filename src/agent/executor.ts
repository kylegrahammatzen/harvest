import type { Autumn, CustomerExpand, Range } from "autumn-js";
import { parseApiError, str, num } from "@/agent/shared";

type ToolResult = { success: true; data: unknown } | { success: false; error: string };
type ToolParams = Record<string, unknown>;

const toolHandlers: Record<string, (autumn: Autumn, p: ToolParams) => Promise<unknown>> = {
	get_customer: (autumn, p) =>
		autumn.customers.getOrCreate({
			customerId: str(p.customer_id),
			expand: p.expand as CustomerExpand[] | undefined,
		}),
	list_customers: (autumn, p) =>
		autumn.customers.list({ limit: num(p.limit, 50), offset: num(p.offset, 0) }),
	check_feature_access: (autumn, p) =>
		autumn.check({ customerId: str(p.customer_id), featureId: str(p.feature_id) }),
	get_usage_aggregate: (autumn, p) => {
		const raw = str(p.feature_id);
		const featureId = raw.includes(",") ? raw.split(",").map((s) => s.trim()) : raw;
		return autumn.events.aggregate({
			customerId: str(p.customer_id),
			featureId,
			range: str(p.range, "30d") as Range,
		});
	},
	list_events: (autumn, p) =>
		autumn.events.list({
			customerId: str(p.customer_id),
			featureId: str(p.feature_id),
			limit: num(p.limit, 20),
		}),
	list_plans: (autumn) => autumn.plans.list(),
	get_plan: (autumn, p) => autumn.plans.get({ planId: str(p.plan_id) }),
	list_features: (autumn) => autumn.features.list(),
	get_feature: (autumn, p) => autumn.features.get({ featureId: str(p.feature_id) }),
	get_entity: (autumn, p) =>
		autumn.entities.get({ customerId: str(p.customer_id), entityId: str(p.entity_id) }),
	get_billing_portal_url: (autumn, p) =>
		autumn.billing.openCustomerPortal({ customerId: str(p.customer_id) }),
};

export async function executeTool(
	name: string,
	params: ToolParams,
	autumn: Autumn,
): Promise<ToolResult> {
	const handler = toolHandlers[name];
	if (!handler) return { success: false, error: `Unknown tool: ${name}` };
	try {
		const data = await handler(autumn, params);
		return { success: true, data };
	} catch (err) {
		return { success: false, error: parseApiError(err) };
	}
}
