export type LocalizedString = import('../runtime.js').LocalizedString;
export type Feature_Profile_BodyInputs = {};
/**
* | output |
* | --- |
* | "Write your name and an introduction, and have your own page." |
*
* @param {Feature_Profile_BodyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const feature_profile_body: ((inputs?: Feature_Profile_BodyInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Feature_Profile_BodyInputs, {
    locale?: "ja" | "en";
}, {}>;
