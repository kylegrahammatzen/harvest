import type Anthropic from "@anthropic-ai/sdk";

const p = {
	customer_id: { type: "string", description: "The customer ID" },
	feature_id: { type: "string", description: "The feature ID" },
	plan_id: { type: "string", description: "The plan/product ID" },
};

function defineTool(
	name: string,
	description: string,
	properties: Record<string, unknown>,
	required: string[] = [],
): Anthropic.Tool {
	return { name, description, input_schema: { type: "object" as const, properties, required } };
}

const readTools = [
	defineTool(
		"get_customer",
		"Get a customer by ID with their plan, balances, and subscription info.",
		{
			customer_id: p.customer_id,
			expand: {
				type: "array",
				items: {
					type: "string",
					enum: ["invoices", "entities", "rewards", "payment_method"],
				},
				description: "Optional data to expand",
			},
		},
		["customer_id"],
	),
	defineTool("list_customers", "List customers with pagination.", {
		limit: { type: "number", description: "Max results (default 50)" },
		offset: { type: "number", description: "Pagination offset" },
	}),
	defineTool(
		"check_feature_access",
		"Check if a customer has access to a feature and their remaining balance.",
		{ customer_id: p.customer_id, feature_id: p.feature_id },
		["customer_id", "feature_id"],
	),
	defineTool(
		"get_usage_aggregate",
		"Get aggregated usage events over a time range.",
		{
			customer_id: p.customer_id,
			feature_id: { type: "string", description: "Feature ID or comma-separated feature IDs" },
			range: {
				type: "string",
				enum: ["24h", "7d", "30d", "90d", "last_cycle"],
				description: "Time range (default: 30d)",
			},
		},
		["customer_id", "feature_id"],
	),
	defineTool(
		"list_events",
		"List usage events for a customer.",
		{
			customer_id: p.customer_id,
			feature_id: p.feature_id,
			limit: { type: "number", description: "Max results (default 20)" },
		},
		["customer_id", "feature_id"],
	),
	defineTool("list_plans", "List all available plans with their features and pricing.", {}),
	defineTool("get_plan", "Get details of a specific plan.", { plan_id: p.plan_id }, ["plan_id"]),
	defineTool("list_features", "List all defined features.", {}),
	defineTool("get_feature", "Get details of a specific feature.", { feature_id: p.feature_id }, [
		"feature_id",
	]),
	defineTool(
		"get_entity",
		"Get an entity with its balances.",
		{
			customer_id: p.customer_id,
			entity_id: { type: "string", description: "The entity ID" },
		},
		["customer_id", "entity_id"],
	),
	defineTool(
		"get_billing_portal_url",
		"Generate a billing portal URL for a customer.",
		{ customer_id: p.customer_id },
		["customer_id"],
	),
];

const mutatingTools = [
	defineTool(
		"create_customer",
		"Create a new customer in Autumn.",
		{
			name: { type: "string", description: "Customer display name" },
			email: { type: "string", description: "Customer email address" },
		},
		["email"],
	),
	defineTool(
		"create_balance",
		"Create a new balance for a customer feature.",
		{
			customer_id: p.customer_id,
			feature_id: p.feature_id,
			amount: { type: "number", description: "Amount to grant" },
			unlimited: { type: "boolean", description: "Grant unlimited access" },
		},
		["customer_id", "feature_id"],
	),
	defineTool(
		"set_balance",
		"Set a customer's feature balance to an exact value.",
		{
			customer_id: p.customer_id,
			feature_id: p.feature_id,
			balance: { type: "number", description: "Exact balance value to set" },
		},
		["customer_id", "feature_id", "balance"],
	),
	defineTool(
		"track_usage",
		"Record a usage event for a customer feature.",
		{
			customer_id: p.customer_id,
			feature_id: p.feature_id,
			value: {
				type: "number",
				description: "Usage value (positive to consume, negative to credit back)",
			},
		},
		["customer_id", "feature_id", "value"],
	),
	defineTool(
		"attach_plan",
		"Subscribe a customer to a plan.",
		{
			customer_id: p.customer_id,
			plan_id: p.plan_id,
			customize: {
				type: "object",
				description: "Override plan defaults (custom pricing, trial)",
				properties: {
					price: { type: "number", description: "Custom price in dollars (e.g. 29.99)" },
					trial_days: { type: "number", description: "Custom trial period in days" },
				},
			},
			success_url: {
				type: "string",
				description: "URL to redirect to after successful checkout",
			},
			invoice_mode: {
				type: "boolean",
				description: "If true, create an invoice instead of a checkout session",
			},
		},
		["customer_id", "plan_id"],
	),
	defineTool(
		"update_subscription",
		"Update an existing subscription.",
		{
			customer_id: p.customer_id,
			plan_id: p.plan_id,
			feature_quantities: {
				type: "array",
				items: {
					type: "object",
					properties: {
						feature_id: { type: "string" },
						quantity: { type: "number" },
					},
					required: ["feature_id", "quantity"],
				},
				description: "Updated feature quantities",
			},
			cancel_action: {
				type: "string",
				enum: ["cancel_immediately", "cancel_end_of_cycle", "uncancel"],
				description: "Cancellation action",
			},
		},
		["customer_id", "plan_id"],
	),
	defineTool(
		"generate_checkout_url",
		"Generate a Stripe checkout URL for a customer.",
		{ customer_id: p.customer_id, plan_id: p.plan_id },
		["customer_id", "plan_id"],
	),
	defineTool(
		"setup_payment",
		"Generate a payment method setup link for a customer.",
		{ customer_id: p.customer_id },
		["customer_id"],
	),
	defineTool(
		"update_customer",
		"Update a customer's name or email.",
		{
			customer_id: p.customer_id,
			name: { type: "string", description: "New name" },
			email: { type: "string", description: "New email" },
		},
		["customer_id"],
	),
	defineTool(
		"create_referral_code",
		"Create a referral code for a customer.",
		{
			customer_id: p.customer_id,
			program_id: { type: "string", description: "The referral program ID" },
		},
		["customer_id", "program_id"],
	),
	defineTool(
		"redeem_referral_code",
		"Redeem a referral code for a customer.",
		{
			code: { type: "string", description: "The referral code" },
			customer_id: p.customer_id,
		},
		["code", "customer_id"],
	),
];

export const agentTools: Anthropic.Tool[] = [...readTools, ...mutatingTools];
export const MUTATING_TOOLS = new Set(mutatingTools.map((t) => t.name));
