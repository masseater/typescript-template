import type { Page } from "playwright";

const authenticatorOptions = {
  automaticPresenceSimulation: true,
  hasResidentKey: true,
  hasUserVerification: true,
  isUserVerified: true,
  protocol: "ctap2",
  transport: "internal",
} as const;

const enableVirtualAuthenticator = async (page: Page): Promise<void> => {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable", { enableUI: false });
  const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: authenticatorOptions,
  });
  await client.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: true });
  await client.send("WebAuthn.setAutomaticPresenceSimulation", {
    authenticatorId,
    enabled: true,
  });
};

export { enableVirtualAuthenticator };
