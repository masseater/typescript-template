/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Feature_Profile_TitleInputs */

const ja_feature_profile_title = /** @type {(inputs: Feature_Profile_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`プロフィールを作る`)
};

const en_feature_profile_title = /** @type {(inputs: Feature_Profile_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create a profile`)
};

/**
* | output |
* | --- |
* | "Create a profile" |
*
* @param {Feature_Profile_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const feature_profile_title = /** @type {((inputs?: Feature_Profile_TitleInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Feature_Profile_TitleInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_feature_profile_title(inputs)
	return ja_feature_profile_title(inputs)
});