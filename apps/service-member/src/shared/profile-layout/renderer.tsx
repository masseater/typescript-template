import { PHOTO_SLOT } from "@repo/config";
import { Avatar, Heading, TextLink, formatWarekiMonth } from "@repo/ui";
import { Fragment } from "react";

import { displayValue, fieldDefinitions } from "#shared/interview/sheet.ts";
import { memberPhotoUrl } from "#shared/photo-url/index.ts";
import { SocialLinks } from "#shared/social-link/index.ts";
import { profileBlock } from "./schema.ts";

import type { FieldName, SheetData } from "#shared/interview/sheet.ts";
import type { ReactElement } from "react";
import type { ProfileBlockKind, ProfileLayoutData } from "./schema.ts";

interface ProfileMember {
  readonly id: string;
  readonly joined: string;
  readonly name: string;
  readonly photos: Readonly<{ company: string | null; face: string | null }>;
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

function CompanyPhoto({
  memberId,
  version,
}: Readonly<{ memberId: string; version: string | null }>): ReactElement | undefined {
  const src = memberPhotoUrl(memberId, PHOTO_SLOT.company, version);
  if (src === undefined) {
    return undefined;
  }
  return (
    <img
      alt="会社の写真"
      className="aspect-video w-full rounded-lg border border-border object-cover"
      decoding="async"
      src={src}
    />
  );
}

function Identity({ member }: Readonly<{ member: ProfileMember }>): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar
          name={member.name}
          size="large"
          src={memberPhotoUrl(member.id, PHOTO_SLOT.face, member.photos.face)}
        />
        <Heading as="h1" size="page">
          {member.name}
        </Heading>
      </div>
      <CompanyPhoto memberId={member.id} version={member.photos.company} />
    </div>
  );
}

interface BlockContext {
  readonly actions: ReactElement | undefined;
  readonly member: ProfileMember;
  readonly own: boolean;
  readonly sheet: SheetData;
}

type BlockRenderer = (context: BlockContext) => ReactElement | undefined;

function sheetBlock(key: FieldName): BlockRenderer {
  return ({ sheet }) => (
    <SheetField label={fieldDefinitions[key].label} value={displayValue(sheet, key)} />
  );
}

const blockRenderers: Readonly<Record<ProfileBlockKind, BlockRenderer>> = {
  [profileBlock.actions]: ({ actions }) =>
    actions === undefined ? undefined : <div className="flex flex-col gap-3">{actions}</div>,
  [profileBlock.biography]: ({ member, own }) => <Biography own={own} text={member.profile} />,
  [profileBlock.identity]: ({ member }) => <Identity member={member} />,
  [profileBlock.joined]: ({ member }) => (
    <p className="text-sm leading-normal text-muted-foreground">
      {formatWarekiMonth(member.joined)}に登録
    </p>
  ),
  [profileBlock.sheetArea]: sheetBlock("area"),
  [profileBlock.sheetInterests]: sheetBlock("interests"),
  [profileBlock.sheetMessage]: sheetBlock("message"),
  [profileBlock.sheetNickname]: sheetBlock("nickname"),
  [profileBlock.sheetOccupation]: sheetBlock("occupation"),
  [profileBlock.socialLinks]: ({ member }) => <SocialLinks urls={member.socialLinks} />,
};

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
  const context = { actions, member, own, sheet };
  return (
    <>
      {layout.blocks.map((block) => (
        <Fragment key={block.kind}>{blockRenderers[block.kind](context)}</Fragment>
      ))}
    </>
  );
}

export { ProfileLayoutRenderer };
export type { ProfileMember };
