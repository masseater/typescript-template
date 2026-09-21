export type LocalizedString = import('../runtime.js').LocalizedString;
export type Signup_Sent_BodyInputs = {};
/**
* | output |
* | --- |
* | "Open the link in the email to verify your address, then log in." |
*
* @param {Signup_Sent_BodyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const signup_sent_body: ((inputs?: Signup_Sent_BodyInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Sent_BodyInputs, {
    locale?: "ja" | "en";
}, {}>;
