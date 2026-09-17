import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@template/ui/auth";
import uiStyles from "@template/ui/styles.css?url";
import * as v from "valibot";

export const Route = createFileRoute("/login")({
  head: () => ({ links: [{ rel: "stylesheet", href: uiStyles }] }),
  component: Login,
});

const redirectSchema = v.object({ url: v.string() });

async function continueAuthorization() {
  const oauthQuery = window.location.search.slice(1);
  if (!new URLSearchParams(oauthQuery).has("sig")) {
    window.location.assign("/");
    return;
  }
  const response = await fetch("/api/auth/oauth2/continue", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ postLogin: true, oauth_query: oauthQuery }),
  });
  if (response.status === 403) {
    window.location.assign("/security");
    return;
  }
  if (!response.ok) throw new Error("連携の許可を続けられませんでした。");
  window.location.assign(v.parse(redirectSchema, await response.json()).url);
}

function Login() {
  return (
    <LoginPage title="Wiki にログイン" signUp={false} onAuthenticated={continueAuthorization} />
  );
}
