const mailLinkPattern = /https?:\/\/[^\s"'<>\\]+/gu;

const deliveryTimeout = 60_000;

export { deliveryTimeout, mailLinkPattern };
