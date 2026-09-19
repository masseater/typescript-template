/** @canonical-values ui.challenge-mode */
const challengeModes = ["backup", "totp"] as const;

type ChallengeMode = (typeof challengeModes)[number];

const CHALLENGE_MODE = { backup: challengeModes[0], totp: challengeModes[1] } as const;

export { CHALLENGE_MODE };
export type { ChallengeMode };
