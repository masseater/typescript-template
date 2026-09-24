import { Schema } from "effect";

const GoogleAnalyticsMeasurementId = Schema.String.check(Schema.isPattern(/^G-[A-Z0-9]{1,48}$/u));

const activeGoogleAnalyticsMeasurementId = (input: {
  readonly GOOGLE_ANALYTICS_MEASUREMENT_ID?: string | undefined;
  readonly local: boolean;
}): string | undefined => (input.local ? undefined : input.GOOGLE_ANALYTICS_MEASUREMENT_ID);

export { GoogleAnalyticsMeasurementId, activeGoogleAnalyticsMeasurementId };
