export type LocalizedString = import('../runtime.js').LocalizedString;
export type Signup_Sent_TitleInputs = {};
/**
* | output |
* | --- |
* | "Check your email" |
*
* @param {Signup_Sent_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const signup_sent_title: ((inputs?: Signup_Sent_TitleInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Sent_TitleInputs, {
    locale?: "ja" | "en";
}, {}>;
