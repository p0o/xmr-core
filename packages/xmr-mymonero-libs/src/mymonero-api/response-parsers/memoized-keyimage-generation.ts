import { HWDevice, key_image } from "@xmr-core/xmr-crypto-utils";
const { derive_key_image_from_tx } = key_image;

// Managed caches - Can be used by apps which can't send a mutable_keyImagesByCacheKey

export type KeyImageCache = { [cacheIndex: string]: string };
export type KeyImageCacheMap = { [address: string]: KeyImageCache };

const keyImagesByWalletId: KeyImageCacheMap = {};

/**
 * @description Performs a memoized computation of a key image
 * @param {KeyImageCache} keyImageCache
 * @param {string} txPubKey
 * @param {number} outIndex
 * @param {string} address
 * @param {string} privViewKey
 * @param {string} pubSpendKey
 * @param {string} privSpendKey
 * @returns
 */
export async function genKeyImageFromTx(
	keyImageCache: KeyImageCache,
	txPubKey: string,
	outIndex: number,
	address: string,
	privViewKey: string,
	pubSpendKey: string,
	privSpendKey: string,
	hwdev: HWDevice,
) {
	const cacheIndex = `${txPubKey}:${address}:${outIndex}`;
	const cachedKeyImage = keyImageCache[cacheIndex];

	if (cachedKeyImage) {
		return cachedKeyImage;
	}

	const { key_image } = await derive_key_image_from_tx(
		txPubKey,
		privViewKey,
		pubSpendKey,
		privSpendKey,
		outIndex,
		hwdev,
	);

	// cache the computed key image
	keyImageCache[cacheIndex] = key_image;

	return key_image;
}

/**
 *
 * @description Get a key image cache, that's mapped by address
 * @export
 * @param {string} address
 */
export function getKeyImageCache(address: string) {
	const cacheId = parseAddress(address);

	let cache = keyImagesByWalletId[cacheId];
	if (!cache) {
		cache = {};
		keyImagesByWalletId[cacheId] = cache;
	}
	return cache;
}

/**
 * @description Clears a key image cache that's mapped by the users address
 *
 *
 * IMPORTANT: Ensure you call this method when you want to clear your wallet from
 * memory or delete it, or else you could leak key images and public addresses.
 * @export
 * @param {string} address
 */
export function clearKeyImageCache(address: string) {
	const cacheId = parseAddress(address);

	delete keyImagesByWalletId[cacheId];

	const cache = keyImagesByWalletId[cacheId];

	if (cache) {
		throw Error("Key image cache still exists after deletion");
	}
}

/**
 * @description Normalize an address before using it to access the key image cache map as a key
 * @param {string} address
 */
function parseAddress(address: string) {
	// NOTE: making the assumption that public_address is unique enough to identify a wallet for caching....
	// FIXME: with subaddresses, is that still the case? would we need to split them up by subaddr anyway?
	if (!address) {
		throw Error("Address does not exist");
	}

	return address.toString();
}
