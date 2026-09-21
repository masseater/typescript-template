export type LocalizedString = import('../runtime.js').LocalizedString;
export type Signup_To_LoginInputs = {};
/**
* | output |
* | --- |
* | "Already have an account?" |
*
* @param {Signup_To_LoginInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const signup_to_login: ((inputs?: Signup_To_LoginInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_To_LoginInputs, {
    locale?: "ja" | "en";
}, {}>;
