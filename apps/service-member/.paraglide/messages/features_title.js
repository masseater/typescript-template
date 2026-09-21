/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Features_TitleInputs */

const ja_features_title = /** @type {(inputs: Features_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`できること`)
};

const en_features_title = /** @type {(inputs: Features_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What you can do`)
};

/**
* | output |
* | --- |
* | "What you can do" |
*
* @param {Features_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const features_title = /** @type {((inputs?: Features_TitleInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Features_TitleInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_features_title(inputs)
	return ja_features_title(inputs)
});