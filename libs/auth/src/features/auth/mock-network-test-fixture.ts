import { setupNetwork } from "@msw/cloudflare";
import { Context, Effect, Layer } from "effect";

type Network = ReturnType<typeof setupNetwork>;

class MockNetwork extends Context.Service<MockNetwork, Network>()(
  "@repo/auth/features/auth/mock-network-test-fixture/MockNetwork",
) {}

const startNetwork = (): Network => {
  const network = setupNetwork();
  network.configure({ onUnhandledFrame: "error" });
  network.enable();
  return network;
};

const stopNetwork = (network: Readonly<Network>): Effect.Effect<void> =>
  Effect.sync(() => {
    network.disable();
  });

const mockNetwork = Layer.effect(
  MockNetwork,
  Effect.acquireRelease(Effect.sync(startNetwork), stopNetwork),
);

export { MockNetwork, mockNetwork };
