export type LocalizedString = import('../runtime.js').LocalizedString;
export type Signup_Sent_LoginInputs = {};
/**
* | output |
* | --- |
* | "Go to log in" |
*
* @param {Signup_Sent_LoginInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const signup_sent_login: ((inputs?: Signup_Sent_LoginInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Sent_LoginInputs, {
    locale?: "ja" | "en";
}, {}>;
