export type LocalizedString = import('../runtime.js').LocalizedString;
export type Feature_Profile_TitleInputs = {};
/**
* | output |
* | --- |
* | "Create a profile" |
*
* @param {Feature_Profile_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const feature_profile_title: ((inputs?: Feature_Profile_TitleInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Feature_Profile_TitleInputs, {
    locale?: "ja" | "en";
}, {}>;
