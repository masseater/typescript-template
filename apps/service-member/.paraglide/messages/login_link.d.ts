export type LocalizedString = import('../runtime.js').LocalizedString;
export type Login_LinkInputs = {};
/**
* | output |
* | --- |
* | "Log in" |
*
* @param {Login_LinkInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const login_link: ((inputs?: Login_LinkInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_LinkInputs, {
    locale?: "ja" | "en";
}, {}>;
