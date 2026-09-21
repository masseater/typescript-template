export type LocalizedString = import('../runtime.js').LocalizedString;
export type Signup_PendingInputs = {};
/**
* | output |
* | --- |
* | "Creating your account." |
*
* @param {Signup_PendingInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const signup_pending: ((inputs?: Signup_PendingInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_PendingInputs, {
    locale?: "ja" | "en";
}, {}>;
