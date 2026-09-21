export type LocalizedString = import('../runtime.js').LocalizedString;
export type Home_Profile_EmptyInputs = {};
/**
* | output |
* | --- |
* | "No introduction yet." |
*
* @param {Home_Profile_EmptyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const home_profile_empty: ((inputs?: Home_Profile_EmptyInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_Profile_EmptyInputs, {
    locale?: "ja" | "en";
}, {}>;
