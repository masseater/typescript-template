const httpStatus = {
  accepted: 202,
  badGateway: 502,
  badRequest: 400,
  forbidden: 403,
  gatewayTimeout: 504,
  internalServerError: 500,
  methodNotAllowed: 405,
  payloadTooLarge: 413,
  serviceUnavailable: 503,
  tooManyRequests: 429,
  unsupportedMediaType: 415,
} as const;

export { httpStatus };
