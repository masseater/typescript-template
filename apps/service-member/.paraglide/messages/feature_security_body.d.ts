export type LocalizedString = import('../runtime.js').LocalizedString;
export type Feature_Security_BodyInputs = {};
/**
* | output |
* | --- |
* | "Make login stronger with passkeys and two-factor authentication." |
*
* @param {Feature_Security_BodyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const feature_security_body: ((inputs?: Feature_Security_BodyInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Feature_Security_BodyInputs, {
    locale?: "ja" | "en";
}, {}>;
