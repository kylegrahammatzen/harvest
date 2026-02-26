import type Anthropic from "@anthropic-ai/sdk";

export const agentTools: Anthropic.Tool[] = [
	{
		name: "get_customer",
		description:
			"Get a customer by ID with their plan, balances, invoices, and subscription info. Use expand to include additional data like invoices, entities, rewards, payment_method.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				expand: {
					type: "array",
					items: { type: "string", enum: ["invoices", "entities", "rewards", "payment_method"] },
					description: "Optional data to expand",
				},
			},
			required: ["customer_id"],
		},
	},
	{
		name: "list_customers",
		description:
			"List customers with pagination. Returns customer IDs, names, emails, and their active plans.",
		input_schema: {
			type: "object" as const,
			properties: {
				limit: { type: "number", description: "Max results (default 50)" },
				offset: { type: "number", description: "Pagination offset" },
			},
			required: [],
		},
	},
	{
		name: "check_feature_access",
		description:
			"Check if a customer has access to a feature and their remaining balance. Returns allowed (boolean), balance, usage, included_usage, unlimited status.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				feature_id: { type: "string", description: "The feature ID to check" },
			},
			required: ["customer_id", "feature_id"],
		},
	},
	{
		name: "get_usage_aggregate",
		description:
			"Get aggregated usage events over a time range. Shows usage totals grouped by feature and time period.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				feature_id: {
					type: "string",
					description: "Feature ID or comma-separated feature IDs",
				},
				range: {
					type: "string",
					enum: ["24h", "7d", "30d", "90d", "last_cycle"],
					description: "Time range (default: 30d)",
				},
			},
			required: ["customer_id", "feature_id"],
		},
	},
	{
		name: "list_events",
		description:
			"List individual usage events for a customer. Returns event details with timestamps.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				feature_id: { type: "string", description: "Feature ID to filter by" },
				limit: { type: "number", description: "Max results (default 20)" },
			},
			required: ["customer_id", "feature_id"],
		},
	},
	{
		name: "list_plans",
		description:
			"List all available plans/products with their features, pricing, and configuration.",
		input_schema: {
			type: "object" as const,
			properties: {},
			required: [],
		},
	},
	{
		name: "get_plan",
		description: "Get details of a specific plan including its features, pricing, and items.",
		input_schema: {
			type: "object" as const,
			properties: {
				plan_id: { type: "string", description: "The plan/product ID" },
			},
			required: ["plan_id"],
		},
	},
	{
		name: "list_features",
		description: "List all defined features with their types (boolean, metered, credit_system).",
		input_schema: {
			type: "object" as const,
			properties: {},
			required: [],
		},
	},
	{
		name: "get_feature",
		description: "Get details of a specific feature including its type and configuration.",
		input_schema: {
			type: "object" as const,
			properties: {
				feature_id: { type: "string", description: "The feature ID" },
			},
			required: ["feature_id"],
		},
	},
	{
		name: "get_entity",
		description:
			"Get an entity (sub-customer resource like a workspace or project) with its balances.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				entity_id: { type: "string", description: "The entity ID" },
			},
			required: ["customer_id", "entity_id"],
		},
	},
	{
		name: "get_billing_portal_url",
		description:
			"Generate a billing portal URL where the customer can self-manage their subscription.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
			},
			required: ["customer_id"],
		},
	},

	{
		name: "create_balance",
		description:
			"Create a new balance for a customer feature. Adds an additive one-off or recurring balance. REQUIRES USER CONFIRMATION before executing.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				feature_id: { type: "string", description: "The feature ID" },
				amount: { type: "number", description: "Amount to grant" },
				unlimited: { type: "boolean", description: "Grant unlimited access" },
			},
			required: ["customer_id", "feature_id"],
		},
	},
	{
		name: "set_balance",
		description:
			"Set a customer's feature balance to an exact value. Overwrites the current balance. REQUIRES USER CONFIRMATION before executing.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				feature_id: { type: "string", description: "The feature ID" },
				balance: { type: "number", description: "Exact balance value to set" },
			},
			required: ["customer_id", "feature_id", "balance"],
		},
	},
	{
		name: "track_usage",
		description:
			"Record a usage event for a customer feature. Positive value consumes balance, negative credits back. REQUIRES USER CONFIRMATION before executing.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				feature_id: { type: "string", description: "The feature ID" },
				value: {
					type: "number",
					description: "Usage value (positive to consume, negative to credit back)",
				},
			},
			required: ["customer_id", "feature_id", "value"],
		},
	},
	{
		name: "attach_plan",
		description:
			"Subscribe a customer to a plan. Handles new subscriptions, upgrades, and downgrades. Supports custom pricing, trial days, success URLs, and invoice mode. REQUIRES USER CONFIRMATION before executing.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				plan_id: { type: "string", description: "The plan/product ID to attach" },
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
			required: ["customer_id", "plan_id"],
		},
	},
	{
		name: "update_subscription",
		description:
			"Update an existing subscription. Can change prepaid quantities, cancel, or uncancel. REQUIRES USER CONFIRMATION before executing.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				plan_id: { type: "string", description: "The plan/product ID" },
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
			required: ["customer_id", "plan_id"],
		},
	},
	{
		name: "generate_checkout_url",
		description:
			"Generate a Stripe checkout URL for a customer to purchase a plan. REQUIRES USER CONFIRMATION before executing.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				plan_id: { type: "string", description: "The plan/product ID" },
			},
			required: ["customer_id", "plan_id"],
		},
	},
	{
		name: "setup_payment",
		description:
			"Generate a link for a customer to add or update their payment method. REQUIRES USER CONFIRMATION before executing.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
			},
			required: ["customer_id"],
		},
	},
	{
		name: "update_customer",
		description: "Update a customer's name or email. REQUIRES USER CONFIRMATION before executing.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				name: { type: "string", description: "New name" },
				email: { type: "string", description: "New email" },
			},
			required: ["customer_id"],
		},
	},
	{
		name: "create_referral_code",
		description:
			"Create a referral code for a customer. REQUIRES USER CONFIRMATION before executing.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
				program_id: { type: "string", description: "The referral program ID" },
			},
			required: ["customer_id", "program_id"],
		},
	},
	{
		name: "redeem_referral_code",
		description:
			"Redeem a referral code for a customer. REQUIRES USER CONFIRMATION before executing.",
		input_schema: {
			type: "object" as const,
			properties: {
				code: { type: "string", description: "The referral code" },
				customer_id: { type: "string", description: "The customer ID" },
			},
			required: ["code", "customer_id"],
		},
	},

	{
		name: "upcoming_renewals",
		description:
			"Find customers whose subscriptions renew within a given time period. Combines customer listing with renewal date filtering.",
		input_schema: {
			type: "object" as const,
			properties: {
				period: {
					type: "string",
					description: "Time window, e.g. '7d', '14d', '30d'",
				},
			},
			required: ["period"],
		},
	},
	{
		name: "customers_near_limit",
		description:
			"Find customers who are approaching their usage limits (above 80% by default). Scans all customers and their feature balances.",
		input_schema: {
			type: "object" as const,
			properties: {
				threshold_pct: {
					type: "number",
					description: "Usage threshold percentage (default 80)",
				},
				feature_id: {
					type: "string",
					description: "Optional: filter to a specific feature",
				},
			},
			required: [],
		},
	},
	{
		name: "compare_plans",
		description: "Compare two plans side-by-side showing differences in features and pricing.",
		input_schema: {
			type: "object" as const,
			properties: {
				plan_a: { type: "string", description: "First plan ID" },
				plan_b: { type: "string", description: "Second plan ID" },
			},
			required: ["plan_a", "plan_b"],
		},
	},
	{
		name: "suggest_upgrade",
		description:
			"Analyze a customer's usage and suggest whether they should upgrade to a different plan based on usage patterns and overage costs.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
			},
			required: ["customer_id"],
		},
	},
	{
		name: "customer_health_check",
		description:
			"Run a comprehensive health check on a customer. Analyzes usage trends, balance status, subscription health, and payment status to determine if the customer is healthy, at risk, or needs attention.",
		input_schema: {
			type: "object" as const,
			properties: {
				customer_id: { type: "string", description: "The customer ID" },
			},
			required: ["customer_id"],
		},
	},
];

export const MUTATING_TOOLS = new Set([
	"create_balance",
	"set_balance",
	"track_usage",
	"attach_plan",
	"update_subscription",
	"generate_checkout_url",
	"setup_payment",
	"update_customer",
	"create_referral_code",
	"redeem_referral_code",
]);
