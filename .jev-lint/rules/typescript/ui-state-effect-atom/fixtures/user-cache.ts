type User = { id: string; name: string };

const cache = new Map<string, { user: User; fetchedAt: number }>();

export async function getUser(id: string): Promise<User> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.fetchedAt < 60_000) return hit.user;
  const res = await fetch(`/api/users/${id}`);
  const user = (await res.json()) as User;
  cache.set(id, { user, fetchedAt: Date.now() });
  return user;
}
