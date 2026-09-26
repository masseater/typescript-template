const cspNonceHeader = "x-csp-nonce";
const hstsMaxAgeSeconds = 31536000;
const strictTransportSecurity = `max-age=${hstsMaxAgeSeconds}; includeSubDomains`;
export { cspNonceHeader, strictTransportSecurity };
