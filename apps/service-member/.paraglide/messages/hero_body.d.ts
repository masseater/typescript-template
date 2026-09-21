export type LocalizedString = import('../runtime.js').LocalizedString;
export type Hero_BodyInputs = {};
/**
* | output |
* | --- |
* | "Write an intro and find people you care about. Protect your account with passkeys and two-factor authentication." |
*
* @param {Hero_BodyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const hero_body: ((inputs?: Hero_BodyInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Hero_BodyInputs, {
    locale?: "ja" | "en";
}, {}>;
