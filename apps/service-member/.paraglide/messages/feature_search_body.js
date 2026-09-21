/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Feature_Search_BodyInputs */

const ja_feature_search_body = /** @type {(inputs: Feature_Search_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`名前で検索して、気になる人のプロフィールを開けます。`)
};

const en_feature_search_body = /** @type {(inputs: Feature_Search_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search by name and open the profile of someone you care about.`)
};

/**
* | output |
* | --- |
* | "Search by name and open the profile of someone you care about." |
*
* @param {Feature_Search_BodyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const feature_search_body = /** @type {((inputs?: Feature_Search_BodyInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Feature_Search_BodyInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_feature_search_body(inputs)
	return ja_feature_search_body(inputs)
});