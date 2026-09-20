import { Avatar, Heading, TextLink, formatWarekiMonth } from "@repo/ui";

import { displayValue, fieldDefinitions } from "#shared/interview/sheet.ts";
import { SocialLinks } from "#shared/social-link";
import { profileBlock } from "./schema.ts";

import type { SheetData } from "#shared/interview/sheet.ts";
import type { ReactElement } from "react";
import type { ProfileLayoutData } from "./schema.ts";

interface ProfileMember {
  readonly id: string;
  readonly joined: string;
  readonly name: string;
  readonly profile: string;
  readonly socialLinks: readonly string[];
}

function SheetField({
  label,
  value,
}: Readonly<{ label: string; value: string | undefined }>): ReactElement | undefined {
  if (value === undefined) {
    return undefined;
  }
  return (
    <section aria-label={label}>
      <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
      <p className="text-base leading-relaxed whitespace-pre-wrap">{value}</p>
    </section>
  );
}

function Biography({ own, text }: Readonly<{ own: boolean; text: string }>): ReactElement {
  if (text !== "") {
    return <p className="text-base leading-relaxed whitespace-pre-wrap">{text}</p>;
  }
  return own ? (
    <p className="text-base leading-normal text-muted-foreground">
      自己紹介はまだありません。<TextLink to="/settings/profile">プロフィールを編集</TextLink>
      して書いてみましょう。
    </p>
  ) : (
    <p className="text-base leading-normal text-muted-foreground">自己紹介はまだありません</p>
  );
}

function ProfileLayoutRenderer({
  actions,
  layout,
  member,
  own,
  sheet,
}: Readonly<{
  actions?: ReactElement;
  layout: ProfileLayoutData;
  member: ProfileMember;
  own: boolean;
  sheet: SheetData;
}>): ReactElement {
  const blocks = layout.blocks.map((block) => {
    switch (block.kind) {
      case profileBlock.identity:
        return (
          <div className="flex items-center gap-4" key={block.kind}>
            <Avatar name={member.name} size="large" />
            <Heading as="h1" size="page">
              {member.name}
            </Heading>
          </div>
        );
      case profileBlock.biography:
        return <Biography key={block.kind} own={own} text={member.profile} />;
      case profileBlock.sheetNickname:
        return (
          <SheetField
            key={block.kind}
            label={fieldDefinitions.nickname.label}
            value={displayValue(sheet, "nickname")}
          />
        );
      case profileBlock.sheetOccupation:
        return (
          <SheetField
            key={block.kind}
            label={fieldDefinitions.occupation.label}
            value={displayValue(sheet, "occupation")}
          />
        );
      case profileBlock.sheetInterests:
        return (
          <SheetField
            key={block.kind}
            label={fieldDefinitions.interests.label}
            value={displayValue(sheet, "interests")}
          />
        );
      case profileBlock.sheetArea:
        return (
          <SheetField
            key={block.kind}
            label={fieldDefinitions.area.label}
            value={displayValue(sheet, "area")}
          />
        );
      case profileBlock.sheetMessage:
        return (
          <SheetField
            key={block.kind}
            label={fieldDefinitions.message.label}
            value={displayValue(sheet, "message")}
          />
        );
      case profileBlock.socialLinks:
        return <SocialLinks key={block.kind} urls={member.socialLinks} />;
      case profileBlock.joined:
        return (
          <p className="text-sm leading-normal text-muted-foreground" key={block.kind}>
            {formatWarekiMonth(member.joined)}に登録
          </p>
        );
      case profileBlock.actions:
        return actions === undefined ? undefined : (
          <div className="flex flex-col gap-3" key={block.kind}>
            {actions}
          </div>
        );
      default:
        return undefined;
    }
  });

  return <>{blocks.filter((block) => block !== undefined)}</>;
}

export { ProfileLayoutRenderer };
