import { profileBlock } from "./schema.ts";

import type { ProfileLayoutData } from "./schema.ts";

const baselineProfileLayout: ProfileLayoutData = {
  blocks: [
    { kind: profileBlock.identity },
    { kind: profileBlock.biography },
    { kind: profileBlock.socialLinks },
    { kind: profileBlock.joined },
    { kind: profileBlock.actions },
  ],
};

const interviewProfileLayout: ProfileLayoutData = {
  blocks: [
    { kind: profileBlock.identity },
    { kind: profileBlock.biography },
    { kind: profileBlock.sheetNickname },
    { kind: profileBlock.sheetOccupation },
    { kind: profileBlock.sheetInterests },
    { kind: profileBlock.sheetArea },
    { kind: profileBlock.sheetMessage },
    { kind: profileBlock.socialLinks },
    { kind: profileBlock.joined },
    { kind: profileBlock.actions },
  ],
};

export { baselineProfileLayout, interviewProfileLayout };
