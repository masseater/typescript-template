/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Feature_Security_TitleInputs */

const ja_feature_security_title = /** @type {(inputs: Feature_Security_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`アカウントを守る`)
};

const en_feature_security_title = /** @type {(inputs: Feature_Security_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Protect your account`)
};

/**
* | output |
* | --- |
* | "Protect your account" |
*
* @param {Feature_Security_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const feature_security_title = /** @type {((inputs?: Feature_Security_TitleInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Feature_Security_TitleInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_feature_security_title(inputs)
	return ja_feature_security_title(inputs)
});