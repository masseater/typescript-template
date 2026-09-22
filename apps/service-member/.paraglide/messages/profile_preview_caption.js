/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Profile_Preview_CaptionInputs */

const ja_profile_preview_caption = /** @type {(inputs: Profile_Preview_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`プロフィールの見本`)
};

const en_profile_preview_caption = /** @type {(inputs: Profile_Preview_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sample profile`)
};

/**
* | output |
* | --- |
* | "Sample profile" |
*
* @param {Profile_Preview_CaptionInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const profile_preview_caption = /** @type {((inputs?: Profile_Preview_CaptionInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Profile_Preview_CaptionInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_profile_preview_caption(inputs)
	return ja_profile_preview_caption(inputs)
});