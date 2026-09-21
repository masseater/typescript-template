export type LocalizedString = import('../runtime.js').LocalizedString;
export type Login_To_SignupInputs = {};
/**
* | output |
* | --- |
* | "Don't have an account?" |
*
* @param {Login_To_SignupInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const login_to_signup: ((inputs?: Login_To_SignupInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_To_SignupInputs, {
    locale?: "ja" | "en";
}, {}>;
