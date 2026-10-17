import { initializePostHog } from "@/lib/analytics/posthog";

// The regional decision runs before SDK initialization without delaying hydration.
void initializePostHog();
