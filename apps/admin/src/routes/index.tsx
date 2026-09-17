import { createFileRoute } from "@tanstack/react-router";
import { requestJson } from "@template/runtime/client";
import { Page, Status, useSession } from "@template/ui";
import { SignOutButton } from "@template/ui/auth";
import { useCallback, useEffect, useState } from "react";
import { Button, Table, Th, Td } from "smarthr-ui";
import {
  RoleChanged,
  UserDeleted,
  UserList as UserListContract,
} from "@template/runtime/contracts";

type UserList = typeof UserListContract.Type;
export const Route = createFileRoute("/")({ component: Users });

function Users() {
  const { session, loading, error: sessionError } = useSession();
  const [data, setData] = useState<UserList | null>(null);
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await requestJson(`/api/users?limit=50&offset=${offset}`, UserListContract));
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : "一覧の取得に失敗しました。");
    }
  }, [offset]);
  const authorized = session?.strong === true && session.user.role === "admin";
  useEffect(() => {
    if (!authorized) return undefined;
    let active = true;
    void requestJson(`/api/users?limit=50&offset=${offset}`, UserListContract)
      .then((body) => {
        if (active) setData(body);
        return undefined;
      })
      .catch((cause: unknown) => {
        if (active) {
          setData(null);
          setError(cause instanceof Error ? cause.message : "一覧の取得に失敗しました。");
        }
      });
    return () => {
      active = false;
    };
  }, [authorized, offset]);
  function mutate(user: UserList["users"][number], method: "PATCH" | "DELETE") {
    if (
      !window.confirm(
        method === "DELETE"
          ? `${user.email} を削除しますか？`
          : `${user.email} の権限を変更しますか？`,
      )
    )
      return;
    setPending(true);
    setError("");
    setMessage("");
    async function update() {
      try {
        if (method === "DELETE")
          await requestJson("/api/users", UserDeleted, { method, body: { id: user.id } });
        else
          await requestJson("/api/users", RoleChanged, {
            method,
            body: { id: user.id, role: user.role === "admin" ? "user" : "admin" },
          });
        setMessage(
          method === "DELETE"
            ? "ユーザーを削除しました。"
            : "権限を変更しました。既存セッションは失効しました。",
        );
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "変更に失敗しました。");
      } finally {
        setPending(false);
      }
    }
    void update();
  }
  return (
    <Page title="ユーザー管理">
      {loading && <Status>読み込み中です。</Status>}
      {!loading && !session && <a href="/login">管理者ログインへ</a>}
      {session && !authorized && <a href="/security">追加認証を完了してください。</a>}
      {authorized && data && (
        <>
          <Table>
            <thead>
              <tr>
                <Th>ユーザー名</Th>
                <Th>メールアドレス</Th>
                <Th>メール確認</Th>
                <Th>権限</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <Td>{user.name}</Td>
                  <Td>{user.email}</Td>
                  <Td>{user.emailVerified ? "確認済み" : "未確認"}</Td>
                  <Td>{user.role}</Td>
                  <Td>
                    <Button
                      type="button"
                      disabled={pending}
                      aria-label={`${user.email} を${user.role === "admin" ? "一般ユーザー" : "管理者"}に変更`}
                      onClick={() => mutate(user, "PATCH")}
                    >
                      {user.role === "admin" ? "一般ユーザーに変更" : "管理者に変更"}
                    </Button>{" "}
                    <Button
                      type="button"
                      disabled={pending}
                      aria-label={`${user.email} を削除`}
                      onClick={() => mutate(user, "DELETE")}
                    >
                      削除
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p>{data.total} 件</p>
          <Button
            type="button"
            disabled={offset === 0 || pending}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            前へ
          </Button>
          <Button
            type="button"
            disabled={offset + 50 >= data.total || pending}
            onClick={() => setOffset(offset + 50)}
          >
            次へ
          </Button>
        </>
      )}
      {session && <SignOutButton />}
      {message && <Status>{message}</Status>}
      {(error || sessionError) && <Status error>{error || sessionError}</Status>}
    </Page>
  );
}
