import type { Autumn, CustomerExpand, Range } from "autumn-js";
import { findUpcomingRenewals } from "@/services/renewals";

type ToolResult = { success: true; data: unknown } | { success: false; error: string };

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
			case "upcoming_renewals":
				return await upcomingRenewals(autumn, params);
			case "customers_near_limit":
				return await customersNearLimit(autumn, params);
			case "compare_plans":
				return await comparePlans(autumn, params);
			case "suggest_upgrade":
				return await suggestUpgrade(autumn, params);
			case "customer_health_check":
				return await customerHealthCheck(autumn, params);
			default:
				return { success: false, error: `Unknown tool: ${name}` };
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
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

async function upcomingRenewals(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const period = str(params.period, "7d");
	const { renewals, error } = await findUpcomingRenewals(autumn, period);
	if (error) return { success: false, error };
	return { success: true, data: { count: renewals.length, renewals } };
}

type AtRiskCustomer = {
	customerId: string;
	customerName: string | null;
	featureId: string;
	usage: number;
	granted: number;
	percentUsed: number;
};

async function customersNearLimit(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const threshold = num(params.threshold_pct, 80);
	const filterFeature = str(params.feature_id);
	const result = await autumn.customers.list({ limit: 100 });

	const atRisk: AtRiskCustomer[] = [];

	for (const customer of result.list) {
		for (const [featureId, balance] of Object.entries(customer.balances)) {
			if (balance.unlimited) continue;
			const usage = balance.usage || 0;
			const granted = balance.granted || 0;
			if (granted <= 0) continue;

			const pct = (usage / granted) * 100;
			if (pct >= threshold) {
				if (filterFeature && featureId !== filterFeature) continue;
				atRisk.push({
					customerId: customer.id ?? "",
					customerName: customer.name,
					featureId,
					usage,
					granted,
					percentUsed: Math.round(pct),
				});
			}
		}
	}

	atRisk.sort((a, b) => b.percentUsed - a.percentUsed);
	return { success: true, data: { count: atRisk.length, customers: atRisk } };
}

async function comparePlans(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const [planA, planB] = await Promise.all([
		autumn.plans.get({ planId: str(params.plan_a) }),
		autumn.plans.get({ planId: str(params.plan_b) }),
	]);

	return {
		success: true,
		data: {
			plan_a: planA,
			plan_b: planB,
		},
	};
}

async function suggestUpgrade(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const [customer, plans] = await Promise.all([
		autumn.customers.getOrCreate({ customerId: str(params.customer_id) }),
		autumn.plans.list(),
	]);

	return {
		success: true,
		data: {
			customer,
			available_plans: plans,
			hint: "Compare the customer's current usage against higher tier plan limits to determine if an upgrade would be beneficial.",
		},
	};
}

type FeatureHealth = {
	feature_id: string;
	usage: number;
	granted: number;
	percent_used: number;
};

type HealthIndicators = {
	customer_id: string;
	name: string | null;
	email: string | null;
	active_subscriptions: unknown[];
	features_near_limit: FeatureHealth[];
	features_unlimited: string[];
};

async function customerHealthCheck(autumn: Autumn, params: ToolParams): Promise<ToolResult> {
	const customer = await autumn.customers.getOrCreate({
		customerId: str(params.customer_id),
		expand: ["invoices"],
	});

	const healthIndicators: HealthIndicators = {
		customer_id: customer.id ?? "",
		name: customer.name,
		email: customer.email,
		active_subscriptions: customer.subscriptions.filter((s) => s.status === "active"),
		features_near_limit: [],
		features_unlimited: [],
	};

	for (const [featureId, balance] of Object.entries(customer.balances)) {
		if (balance.unlimited) {
			healthIndicators.features_unlimited.push(featureId);
			continue;
		}
		const usage = balance.usage || 0;
		const granted = balance.granted || 0;
		if (granted > 0 && usage / granted >= 0.8) {
			healthIndicators.features_near_limit.push({
				feature_id: featureId,
				usage,
				granted,
				percent_used: Math.round((usage / granted) * 100),
			});
		}
	}

	return { success: true, data: healthIndicators };
}
