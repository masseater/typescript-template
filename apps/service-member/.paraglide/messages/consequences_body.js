/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Consequences_BodyInputs */

const ja_consequences_body = /** @type {(inputs: Consequences_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`気になる人を探すことも、ログインを強くすることも、自分のページがあってからのことです。`)
};

const en_consequences_body = /** @type {(inputs: Consequences_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Finding people and making login stronger both follow from having your own page.`)
};

/**
* | output |
* | --- |
* | "Finding people and making login stronger both follow from having your own page." |
*
* @param {Consequences_BodyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const consequences_body = /** @type {((inputs?: Consequences_BodyInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Consequences_BodyInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_consequences_body(inputs)
	return ja_consequences_body(inputs)
});