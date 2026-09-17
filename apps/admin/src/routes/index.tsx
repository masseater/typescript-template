import { createFileRoute } from "@tanstack/react-router";
import { roles } from "@template/config";
import { requestJson } from "@template/runtime/client";
import { errorMessage, useSession } from "@template/ui";
import { SignOutButton } from "@template/ui/auth";
import {
  Button,
  Page,
  Stack,
  Status,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@template/ui/ui";
import { useEffect, useState } from "react";
import * as v from "valibot";

const usersSchema = v.object({
  users: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      email: v.string(),
      role: v.picklist(roles),
      emailVerified: v.boolean(),
    }),
  ),
  total: v.number(),
});
type UserList = v.InferOutput<typeof usersSchema>;
const fetchUsers = async (offset: number) =>
  v.parse(usersSchema, await requestJson(`/api/users?limit=50&offset=${offset}`));
export const Route = createFileRoute("/")({ component: Users });

function Users() {
  const { session, loading, error: sessionError } = useSession();
  const [data, setData] = useState<UserList | null>(null);
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const authorized = session?.strong === true && session.user.role === "admin";
  useEffect(() => {
    if (!authorized) return undefined;
    let active = true;
    void fetchUsers(offset)
      .then((users) => {
        if (active) setData(users);
        return undefined;
      })
      .catch((cause: unknown) => {
        if (active) {
          setData(null);
          setError(errorMessage(cause));
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
        await requestJson("/api/users", {
          method,
          body:
            method === "DELETE"
              ? { id: user.id }
              : { id: user.id, role: user.role === "admin" ? "user" : "admin" },
        });
        setMessage(
          method === "DELETE"
            ? "ユーザーを削除しました。"
            : "権限を変更しました。既存セッションは失効しました。",
        );
        setData(await fetchUsers(offset));
      } catch (cause) {
        setError(errorMessage(cause));
      } finally {
        setPending(false);
      }
    }
    void update();
  }
  return (
    <Page title="ユーザー管理">
      {loading && <Status variant="pending">読み込み中です。</Status>}
      {!loading && !session && <a href="/login">管理者ログインへ</a>}
      {session && !authorized && <a href="/security">追加認証を完了してください。</a>}
      {authorized && data && (
        <Stack className="gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ユーザー名</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>メール確認</TableHead>
                <TableHead>権限</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.emailVerified ? "確認済み" : "未確認"}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="S"
                        disabled={pending}
                        aria-label={`${user.email} を${user.role === "admin" ? "一般ユーザー" : "管理者"}に変更`}
                        onClick={() => mutate(user, "PATCH")}
                      >
                        {user.role === "admin" ? "一般ユーザーに変更" : "管理者に変更"}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="S"
                        disabled={pending}
                        aria-label={`${user.email} を削除`}
                        onClick={() => mutate(user, "DELETE")}
                      >
                        削除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">{data.total} 件</p>
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
          </div>
        </Stack>
      )}
      {session && <SignOutButton />}
      {message && <Status variant="success">{message}</Status>}
      {(error || sessionError) && <Status variant="error">{error || sessionError}</Status>}
    </Page>
  );
}
