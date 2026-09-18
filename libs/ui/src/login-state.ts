import type { ChallengeMode } from "./challenge-form";
import { Option } from "effect";
import type { TextInput } from "./use-text-input";
import { localState } from "./local-state";
import { useTextInput } from "./use-text-input";

interface LoginState {
  readonly challenge: ChallengeMode | undefined;
  readonly email: TextInput;
  readonly handleChallenge: (mode: ChallengeMode) => void;
  readonly handleRestart: () => void;
  readonly password: TextInput;
}

const useChallenge = localState(Option.none<ChallengeMode>());

function useLoginState(): LoginState {
  const email = useTextInput();
  const password = useTextInput();
  const [challenge, setChallenge] = useChallenge();
  function handleChallenge(mode: ChallengeMode): void {
    setChallenge(Option.some(mode));
  }
  function handleRestart(): void {
    setChallenge(Option.none());
    email.handleChange("");
    password.handleChange("");
  }
  return {
    challenge: Option.getOrUndefined(challenge),
    email,
    handleChallenge,
    handleRestart,
    password,
  };
}

export { useLoginState };
