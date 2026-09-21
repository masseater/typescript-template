export type LocalizedString = import('../runtime.js').LocalizedString;
export type Consequences_BodyInputs = {};
/**
* | output |
* | --- |
* | "Finding people and making login stronger both follow from having your own page." |
*
* @param {Consequences_BodyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const consequences_body: ((inputs?: Consequences_BodyInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Consequences_BodyInputs, {
    locale?: "ja" | "en";
}, {}>;
