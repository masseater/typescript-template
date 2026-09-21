/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Feature_Profile_BodyInputs */

const ja_feature_profile_body = /** @type {(inputs: Feature_Profile_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`名前と自己紹介を書いて、自分のページを持てます。`)
};

const en_feature_profile_body = /** @type {(inputs: Feature_Profile_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write your name and an introduction, and have your own page.`)
};

/**
* | output |
* | --- |
* | "Write your name and an introduction, and have your own page." |
*
* @param {Feature_Profile_BodyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const feature_profile_body = /** @type {((inputs?: Feature_Profile_BodyInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Feature_Profile_BodyInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_feature_profile_body(inputs)
	return ja_feature_profile_body(inputs)
});