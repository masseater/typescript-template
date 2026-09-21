/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Feature_Security_BodyInputs */

const ja_feature_security_body = /** @type {(inputs: Feature_Security_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`パスキーと 2 段階認証で、ログインを強くできます。`)
};

const en_feature_security_body = /** @type {(inputs: Feature_Security_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Make login stronger with passkeys and two-factor authentication.`)
};

/**
* | output |
* | --- |
* | "Make login stronger with passkeys and two-factor authentication." |
*
* @param {Feature_Security_BodyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const feature_security_body = /** @type {((inputs?: Feature_Security_BodyInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Feature_Security_BodyInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_feature_security_body(inputs)
	return ja_feature_security_body(inputs)
});