export type LocalizedString = import('../runtime.js').LocalizedString;
export type Title_UsersInputs = {};
/**
* | output |
* | --- |
* | "Search" |
*
* @param {Title_UsersInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const title_users: ((inputs?: Title_UsersInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_UsersInputs, {
    locale?: "ja" | "en";
}, {}>;
