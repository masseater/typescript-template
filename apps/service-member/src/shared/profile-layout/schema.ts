import { Schema } from "effect";

/** @canonical-values profile-layout.block-kind */
const blockKinds = [
  "actions",
  "biography",
  "identity",
  "joined",
  "sheet-area",
  "sheet-interests",
  "sheet-message",
  "sheet-nickname",
  "sheet-occupation",
  "social-links",
] as const;

const profileBlock = {
  actions: blockKinds[0],
  biography: blockKinds[1],
  identity: blockKinds[2],
  joined: blockKinds[3],
  sheetArea: blockKinds[4],
  sheetInterests: blockKinds[5],
  sheetMessage: blockKinds[6],
  sheetNickname: blockKinds[7],
  sheetOccupation: blockKinds[8],
  socialLinks: blockKinds[9],
} as const;

const BlockKind = Schema.Literals(blockKinds);

const ProfileBlock = Schema.Struct({ kind: BlockKind });

const ProfileLayout = Schema.Struct({
  blocks: Schema.Array(ProfileBlock).check(Schema.isNonEmpty()),
});

type ProfileLayoutData = typeof ProfileLayout.Type;

export { profileBlock, ProfileLayout };
export type { ProfileLayoutData };
