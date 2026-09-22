export type LocalizedString = import('../runtime.js').LocalizedString;
export type Title_UpgradeInputs = {};
/**
* | output |
* | --- |
* | "Paid plan" |
*
* @param {Title_UpgradeInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const title_upgrade: ((inputs?: Title_UpgradeInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_UpgradeInputs, {
    locale?: "ja" | "en";
}, {}>;
