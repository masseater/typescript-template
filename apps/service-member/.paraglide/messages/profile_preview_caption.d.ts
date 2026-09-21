export type LocalizedString = import('../runtime.js').LocalizedString;
export type Profile_Preview_CaptionInputs = {};
/**
* | output |
* | --- |
* | "Sample profile" |
*
* @param {Profile_Preview_CaptionInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const profile_preview_caption: ((inputs?: Profile_Preview_CaptionInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Profile_Preview_CaptionInputs, {
    locale?: "ja" | "en";
}, {}>;
