import { Avatar, Heading, buttonVariants } from "@template/ui/ui";
import { Biography } from "./biography.tsx";
import { Link } from "@tanstack/react-router";
import type { Member } from "#pages/profile/model/member.ts";
import type { ReactElement } from "react";

function joinedLabel(joined: string): string {
  const [year = "", month = ""] = joined.split("-");
  return `${year}年${Number(month)}月に登録`;
}

function ProfilePage({ member, own }: Readonly<{ member: Member; own: boolean }>): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center gap-4">
        <Avatar name={member.name} size="large" />
        <Heading as="h1" size="page">
          {member.name}
        </Heading>
      </div>
      <Biography own={own} text={member.profile} />
      <p className="text-sm leading-normal text-muted-foreground">{joinedLabel(member.joined)}</p>
      {own && (
        <Link to="/settings/profile" className={buttonVariants({ variant: "secondary" })}>
          プロフィールを編集
        </Link>
      )}
    </main>
  );
}

export { ProfilePage };
