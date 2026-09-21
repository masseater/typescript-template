export type LocalizedString = import('../runtime.js').LocalizedString;
export type Hero_TitleInputs = {};
/**
* | output |
* | --- |
* | "Start by having your own page" |
*
* @param {Hero_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const hero_title: ((inputs?: Hero_TitleInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Hero_TitleInputs, {
    locale?: "ja" | "en";
}, {}>;
