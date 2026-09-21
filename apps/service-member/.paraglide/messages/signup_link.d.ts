export type LocalizedString = import('../runtime.js').LocalizedString;
export type Signup_LinkInputs = {};
/**
* | output |
* | --- |
* | "Sign up" |
*
* @param {Signup_LinkInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const signup_link: ((inputs?: Signup_LinkInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_LinkInputs, {
    locale?: "ja" | "en";
}, {}>;
