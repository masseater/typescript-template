export type LocalizedString = import('../runtime.js').LocalizedString;
export type Title_MemberInputs = {};
/**
* | output |
* | --- |
* | "Member" |
*
* @param {Title_MemberInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const title_member: ((inputs?: Title_MemberInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_MemberInputs, {
    locale?: "ja" | "en";
}, {}>;
