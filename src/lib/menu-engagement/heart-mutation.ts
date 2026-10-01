import { heartVoteAllowed } from "./heart-security";

export type HeartStore = {
  has: (restaurantId: string, itemId: string, visitorKey: string) => Promise<boolean>;
  recent: (restaurantId: string, itemId: string) => Promise<number>;
  add: (restaurantId: string, itemId: string, visitorKey: string) => Promise<void>;
  remove: (restaurantId: string, itemId: string, visitorKey: string) => Promise<void>;
  count: (restaurantId: string, itemId: string) => Promise<number>;
};

export async function mutateHeart(
  store: HeartStore,
  input: { restaurantId: string; itemId: string; visitorKey: string; sourceKey: string | null; liked: boolean },
  limiter?: Parameters<typeof heartVoteAllowed>[1],
) {
  const { restaurantId, itemId, visitorKey, sourceKey, liked } = input;
  if (liked) {
    const existing = await store.has(restaurantId, itemId, visitorKey);
    if (!existing) {
      const recent = await store.recent(restaurantId, itemId);
      if (!heartVoteAllowed({ liked, existing, recent, visitorKey, sourceKey, restaurantId, itemId }, limiter)) {
        return { status: 429, body: { error: "Too many new hearts. Try again later." } };
      }
      await store.add(restaurantId, itemId, visitorKey);
    }
  } else {
    await store.remove(restaurantId, itemId, visitorKey);
  }
  return { status: 200, body: { itemId, liked, count: await store.count(restaurantId, itemId) } };
}
