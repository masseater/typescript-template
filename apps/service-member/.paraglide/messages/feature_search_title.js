/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Feature_Search_TitleInputs */

const ja_feature_search_title = /** @type {(inputs: Feature_Search_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`他の利用者を探す`)
};

const en_feature_search_title = /** @type {(inputs: Feature_Search_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Find other members`)
};

/**
* | output |
* | --- |
* | "Find other members" |
*
* @param {Feature_Search_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const feature_search_title = /** @type {((inputs?: Feature_Search_TitleInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Feature_Search_TitleInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_feature_search_title(inputs)
	return ja_feature_search_title(inputs)
});