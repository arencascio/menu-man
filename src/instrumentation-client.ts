import { initializePostHog } from "@/lib/analytics/posthog";

// Fire-and-forget: the regional decision must not hold up hydration.
void initializePostHog();
