import { createFileRoute } from "@tanstack/react-router";
import { requestJson } from "@template/runtime/client";
import { Page, Field, Status, useSession } from "@template/ui";
import { SignOutButton } from "@template/ui/auth";
import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { Button, Stack, Textarea } from "smarthr-ui";
import { ProfileView } from "@template/runtime/contracts";

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
        const data = await requestJson("/api/profile", ProfileView);
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
        const data = await requestJson("/api/profile", ProfileView, {
          method: "PATCH",
          body: { name, profile },
        });
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
      {loading && <Status>読み込み中です。</Status>}
      {!loading && !session && <a href="/login">ログインしてください。</a>}
      {session && (
        <>
          <p>{session.user.email}</p>
          {ready && (
            <form onSubmit={submit} aria-busy={pending}>
              <Stack>
                <Field
                  label="ユーザー名"
                  name="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <label htmlFor={profileId}>自己紹介</label>
                <Textarea
                  id={profileId}
                  name="profile"
                  maxLength={2000}
                  value={profile}
                  onChange={(event) => setProfile(event.target.value)}
                />
                <Button type="submit" variant="primary" disabled={pending}>
                  保存
                </Button>
              </Stack>
            </form>
          )}
          <SignOutButton />
        </>
      )}
      {message && <Status>{message}</Status>}
      {(error || sessionError) && <Status error>{error || sessionError}</Status>}
    </Page>
  );
}
