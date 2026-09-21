/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Nav_ProfileInputs */

const ja_nav_profile = /** @type {(inputs: Nav_ProfileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`プロフィール`)
};

const en_nav_profile = /** @type {(inputs: Nav_ProfileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Profile`)
};

/**
* | output |
* | --- |
* | "Profile" |
*
* @param {Nav_ProfileInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const nav_profile = /** @type {((inputs?: Nav_ProfileInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Nav_ProfileInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_nav_profile(inputs)
	return ja_nav_profile(inputs)
});