export async function postWebhook(url: string, text: string): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(10_000),
    redirect: "manual",
  });
  if (!response.ok) throw new Error("webhook_http_failed");
}
