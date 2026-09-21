export function filterFeaturedItems<T extends { name: string }>(items: T[], search: string): T[] {
  const query = search.trim().toLocaleLowerCase();
  return query ? items.filter((item) => item.name.toLocaleLowerCase().includes(query)) : items;
}

export function toggleFeaturedItem(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((selectedId) => selectedId !== id);
  return ids.length < 20 ? [...ids, id] : ids;
}

export function moveFeaturedItem(ids: string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (target < 0 || target >= ids.length) return ids;
  const result = [...ids];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}
