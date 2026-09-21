export type LocalizedString = import('../runtime.js').LocalizedString;
export type Login_TitleInputs = {};
/**
* | output |
* | --- |
* | "Log in" |
*
* @param {Login_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const login_title: ((inputs?: Login_TitleInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_TitleInputs, {
    locale?: "ja" | "en";
}, {}>;
