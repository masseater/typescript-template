export type LocalizedString = import('../runtime.js').LocalizedString;
export type Admin_Login_TitleInputs = {};
/**
* | output |
* | --- |
* | "Admin log in" |
*
* @param {Admin_Login_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const admin_login_title: ((inputs?: Admin_Login_TitleInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Login_TitleInputs, {
    locale?: "ja" | "en";
}, {}>;
