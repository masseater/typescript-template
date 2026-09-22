import type { Page } from "playwright";

const authenticatorOptions = {
  automaticPresenceSimulation: true,
  hasResidentKey: true,
  hasUserVerification: true,
  isUserVerified: true,
  protocol: "ctap2",
  transport: "internal",
} as const;

const enableVirtualAuthenticator = (page: Page): Promise<void> =>
  page.context()
    .newCDPSession(page)
    .then((client) =>
      client.send("WebAuthn.enable", { enableUI: false }).then(() =>
        client
          .send("WebAuthn.addVirtualAuthenticator", { options: authenticatorOptions })
          .then(({ authenticatorId }) =>
            client
              .send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: true })
              .then(() =>
                client.send("WebAuthn.setAutomaticPresenceSimulation", {
                  authenticatorId,
                  enabled: true,
                }),
              ),
          ),
      ),
    )
    .then(() => undefined);

export { enableVirtualAuthenticator };
