import { createFileRoute } from "@tanstack/react-router";
import { requestJson } from "@template/runtime/client";
import { useSession } from "@template/ui";
import { SignOutButton } from "@template/ui/auth";
import { Button, Field, Label, Page, Stack, Status, Textarea } from "@template/ui/ui";
import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import * as v from "valibot";

const profileSchema = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
  profile: v.string(),
});
export const Route = createFileRoute("/")({ component: Profile });

function Profile() {
  const { session, loading, error: sessionError } = useSession();
  const [name, setName] = useState("");
  const [profile, setProfile] = useState("");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const profileId = useId();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return undefined;
    const controller = { active: true };
    async function load() {
      try {
        const data = v.parse(profileSchema, await requestJson("/api/profile"));
        if (controller.active) {
          setName(data.name);
          setProfile(data.profile);
          setReady(true);
        }
      } catch (cause) {
        if (controller.active)
          setError(cause instanceof Error ? cause.message : "取得に失敗しました。");
      }
    }
    void load();
    return () => {
      controller.active = false;
    };
  }, [userId]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    async function save() {
      try {
        const data = v.parse(
          profileSchema,
          await requestJson("/api/profile", { method: "PATCH", body: { name, profile } }),
        );
        setName(data.name);
        setProfile(data.profile);
        setMessage("プロフィールを保存しました。");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "保存に失敗しました。");
      } finally {
        setPending(false);
      }
    }
    void save();
  }
  return (
    <Page title="プロフィール">
      {loading && <Status variant="pending">読み込み中です。</Status>}
      {!loading && !session && <a href="/login">ログインしてください。</a>}
      {session && (
        <Stack className="max-w-md gap-4">
          <p className="text-muted-foreground">{session.user.email}</p>
          {ready && (
            <form onSubmit={submit} aria-busy={pending}>
              <Stack className="gap-4">
                <Field
                  label="ユーザー名"
                  name="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <Stack className="gap-1">
                  <Label htmlFor={profileId}>自己紹介</Label>
                  <Textarea
                    id={profileId}
                    name="profile"
                    maxLength={2000}
                    value={profile}
                    onChange={(event) => setProfile(event.target.value)}
                  />
                </Stack>
                <Button type="submit" variant="primary" disabled={pending}>
                  保存
                </Button>
              </Stack>
            </form>
          )}
          <SignOutButton />
        </Stack>
      )}
      {message && <Status variant="success">{message}</Status>}
      {(error || sessionError) && <Status variant="error">{error || sessionError}</Status>}
    </Page>
  );
}
