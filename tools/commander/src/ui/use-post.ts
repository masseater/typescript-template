import { useState } from "react";

interface Post {
  readonly failed: boolean;
  readonly pending: boolean;
  readonly send: (body: Readonly<Record<string, string>>) => Promise<boolean>;
}

async function delivered(path: string, body: Readonly<Record<string, string>>): Promise<boolean> {
  return fetch(path, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  }).then(
    (response) => response.ok,
    () => false,
  );
}

function usePost(path: string): Post {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function send(body: Readonly<Record<string, string>>): Promise<boolean> {
    setPending(true);
    setFailed(false);
    const ok = await delivered(path, body);
    setPending(false);
    setFailed(!ok);
    return ok;
  }
  return { failed, pending, send };
}

export { usePost };
