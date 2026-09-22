/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Title_UpgradeInputs */

const ja_title_upgrade = /** @type {(inputs: Title_UpgradeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`有料プラン`)
};

const en_title_upgrade = /** @type {(inputs: Title_UpgradeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Paid plan`)
};

/**
* | output |
* | --- |
* | "Paid plan" |
*
* @param {Title_UpgradeInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const title_upgrade = /** @type {((inputs?: Title_UpgradeInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_UpgradeInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_title_upgrade(inputs)
	return ja_title_upgrade(inputs)
});