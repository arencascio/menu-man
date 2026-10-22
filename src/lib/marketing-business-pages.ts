type ReviewEnvironment = Readonly<Partial<Record<"NODE_ENV" | "VERCEL_ENV" | "MENU_MAN_ENV", string>>>;

// Publication changes require a separate owner review. No URL/query bypass.
export const marketingBusinessPages = {
  cancellation: { href: "/cancellation", label: "Cancellation & data handoff", published: true },
  about: { href: "/about", label: "About Menu Man", published: false },
} as const;

export type MarketingBusinessPage = keyof typeof marketingBusinessPages;

export function isBusinessPageAvailable(page: MarketingBusinessPage, env: ReviewEnvironment = process.env) {
  return marketingBusinessPages[page].published || (
    env.NODE_ENV === "development" && !env.VERCEL_ENV
    && (!env.MENU_MAN_ENV || ["development", "staging"].includes(env.MENU_MAN_ENV))
  );
}

export function getBusinessPageHref(page: MarketingBusinessPage, env: ReviewEnvironment = process.env) {
  return isBusinessPageAvailable(page, env) ? marketingBusinessPages[page].href : null;
}
