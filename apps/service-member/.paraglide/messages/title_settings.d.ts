export type LocalizedString = import('../runtime.js').LocalizedString;
export type Title_SettingsInputs = {};
/**
* | output |
* | --- |
* | "Settings" |
*
* @param {Title_SettingsInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const title_settings: ((inputs?: Title_SettingsInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_SettingsInputs, {
    locale?: "ja" | "en";
}, {}>;
