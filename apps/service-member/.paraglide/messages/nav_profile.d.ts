export type LocalizedString = import('../runtime.js').LocalizedString;
export type Nav_ProfileInputs = {};
/**
* | output |
* | --- |
* | "Profile" |
*
* @param {Nav_ProfileInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const nav_profile: ((inputs?: Nav_ProfileInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Nav_ProfileInputs, {
    locale?: "ja" | "en";
}, {}>;
