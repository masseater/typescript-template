export type LocalizedString = import('../runtime.js').LocalizedString;
export type Feature_Security_TitleInputs = {};
/**
* | output |
* | --- |
* | "Protect your account" |
*
* @param {Feature_Security_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const feature_security_title: ((inputs?: Feature_Security_TitleInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Feature_Security_TitleInputs, {
    locale?: "ja" | "en";
}, {}>;
