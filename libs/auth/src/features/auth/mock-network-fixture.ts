import { setupNetwork } from "@msw/cloudflare";
import { Context, Effect, Layer } from "effect";

type Network = ReturnType<typeof setupNetwork>;

class MockNetwork extends Context.Service<MockNetwork, Network>()("@repo/auth/MockNetwork") {}

const startNetwork = (): Network => {
  const network = setupNetwork();
  network.configure({ onUnhandledFrame: "error" });
  network.enable();
  return network;
};

const stopNetwork = (network: Readonly<Network>): Effect.Effect<void> => {
  return Effect.sync(() => {
    network.disable();
  });
};

const mockNetwork = Layer.effect(
  MockNetwork,
  Effect.acquireRelease(Effect.sync(startNetwork), stopNetwork),
);

export { MockNetwork, mockNetwork };
