export type LocalizedString = import('../runtime.js').LocalizedString;
export type Signup_TitleInputs = {};
/**
* | output |
* | --- |
* | "Sign up" |
*
* @param {Signup_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const signup_title: ((inputs?: Signup_TitleInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_TitleInputs, {
    locale?: "ja" | "en";
}, {}>;
