import { Avatar, ButtonLink, Heading } from "@template/ui";
import { Biography } from "./biography.tsx";
import { ProfileBody } from "./profile-body.tsx";
import type { ReactElement } from "react";
import { memberOptions } from "#pages/profile/api/member-api.ts";
import { useEditedProfile } from "#entities/profile/index.ts";
import { useSuspenseQuery } from "@tanstack/react-query";

const joinedMonth = new Intl.DateTimeFormat("ja", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

function ProfilePage({ id, own }: Readonly<{ id: string; own: boolean }>): ReactElement {
  const { data: member } = useSuspenseQuery(memberOptions(id));
  const edited = useEditedProfile(id);
  const name = edited?.name ?? member.name;
  return (
    <ProfileBody>
      <div className="flex items-center gap-4">
        <Avatar name={name} size="large" />
        <Heading as="h1" size="page">
          {name}
        </Heading>
      </div>
      <Biography own={own} text={edited?.profile ?? member.profile} />
      <p className="text-sm leading-normal text-muted-foreground">
        {joinedMonth.format(new Date(`${member.joined}-01T00:00:00Z`))}に登録
      </p>
      {own && <ButtonLink to="/settings/profile">プロフィールを編集</ButtonLink>}
    </ProfileBody>
  );
}

export { ProfilePage };
