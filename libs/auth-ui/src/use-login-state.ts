import { localState, useTextInput, type TextInput } from "@repo/ui";
import { Option } from "effect";

import type { ChallengeMode } from "./challenge-modes.ts";

const useChallenge = localState(Option.none<ChallengeMode>());

const useLoginState = (): {
  readonly challenge: ChallengeMode | undefined;
  readonly email: TextInput;
  readonly handleChallenge: (challengeMode: ChallengeMode) => void;
  readonly handleRestart: () => void;
  readonly password: TextInput;
} => {
  const email = useTextInput();
  const password = useTextInput();
  const [challenge, setChallenge] = useChallenge();
  const handleChallenge = (challengeMode: ChallengeMode): void => {
    setChallenge(Option.some(challengeMode));
  };
  const handleRestart = (): void => {
    setChallenge(Option.none());
    email.handleChange("");
    password.handleChange("");
  };
  return {
    challenge: Option.getOrUndefined(challenge),
    email,
    handleChallenge,
    handleRestart,
    password,
  };
};

export { useLoginState };
