import { BigInt } from "@xmr-core/biginteger";
import {
	genKeyImageFromTx,
	KeyImageCache,
	getKeyImageCache,
} from "./memoized-keyimage-generation";
import {
	normalizeAddressTransactions,
	normalizeTransaction,
	isKeyImageEqual,
	zeroTransactionAmount,
	calculateTransactionAmount,
	estimateTransactionAmount,
	sortTransactions,
	removeEncryptedPaymentIDs,
	normalizeAddressInfo,
	validateUnspentOutput,
	validateSpendKeyImages,
	validTxPubKey,
} from "./utils";
import {
	AddressTransactions,
	AddressInfo,
	UnspentOuts,
	NormalizedTransaction,
} from "./types";
import { JSONPrettyPrint } from "@xmr-core/xmr-str-utils";
import { HWDevice } from "@xmr-core/xmr-crypto-utils";
import { Output } from "@xmr-core/xmr-transaction";

export async function parseAddressInfo(
	address: string,
	data: AddressInfo,
	privViewKey: string,
	pubSpendKey: string,
	privSpendKey: string,
	hwdev: HWDevice,
	keyImageCache: KeyImageCache = getKeyImageCache(address),
) {
	const normalizedData = normalizeAddressInfo(data);
	let { total_sent } = normalizedData;
	const {
		total_received,
		locked_funds: locked_balance,
		start_height: account_scan_start_height,
		scanned_block_height: account_scanned_tx_height,
		scanned_height: account_scanned_block_height,
		transaction_height,
		blockchain_height,
		rates: ratesBySymbol,
		spent_outputs,
	} = normalizedData;

	for (const spent_output of spent_outputs) {
		const key_image = await genKeyImageFromTx(
			keyImageCache,
			spent_output.tx_pub_key,
			spent_output.out_index,
			address,
			privViewKey,
			pubSpendKey,
			privSpendKey,
			hwdev,
		);

		if (!isKeyImageEqual(spent_output, key_image)) {
			total_sent = new BigInt(total_sent)
				.subtract(spent_output.amount)
				.toString();
		}
	}

	return {
		total_received: new BigInt(total_received),
		locked_balance: new BigInt(locked_balance),
		total_sent: new BigInt(total_sent),

		spent_outputs,
		account_scanned_tx_height,
		account_scanned_block_height,
		account_scan_start_height,
		transaction_height,
		blockchain_height,

		ratesBySymbol,
	};
}

export async function parseAddressTransactions(
	address: string,
	data: AddressTransactions,
	privViewKey: string,
	pubSpendKey: string,
	privSpendKey: string,
	hwdev: HWDevice,
	keyImgCache: KeyImageCache = getKeyImageCache(address),
) {
	const {
		blockchain_height,
		scanned_block_height: account_scanned_block_height,
		scanned_height: account_scanned_height,
		start_height: account_scan_start_height,
		/*total_received*/
		transaction_height,
		transactions,
	} = normalizeAddressTransactions(data);

	const normalizedTransactions: NormalizedTransaction[] = [];

	for (let i = 0; i < transactions.length; i++) {
		const transaction = normalizeTransaction(transactions[i]);

		for (let j = 0; j < transaction.spent_outputs.length; j++) {
			const keyImage = await genKeyImageFromTx(
				keyImgCache,
				transaction.spent_outputs[j].tx_pub_key,
				transaction.spent_outputs[j].out_index,
				address,
				privViewKey,
				pubSpendKey,
				privSpendKey,
				hwdev,
			);

			if (!isKeyImageEqual(transaction.spent_outputs[j], keyImage)) {
				transaction.total_sent = new BigInt(
					transaction.total_sent,
				).subtract(transaction.spent_outputs[j].amount);

				transaction.spent_outputs.splice(j, 1);
				j--;
			}
		}

		if (zeroTransactionAmount(transaction)) {
			transactions.splice(i, 1);
			i--;
			continue;
		}

		transaction.amount = calculateTransactionAmount(transaction);

		transaction.approx_float_amount = estimateTransactionAmount(
			transaction,
		);

		removeEncryptedPaymentIDs(transaction);

		normalizedTransactions.push(transaction);
	}

	sortTransactions(normalizedTransactions);

	// on the other side, we convert transactions timestamp to Date obj

	return {
		account_scanned_height,
		account_scanned_block_height,
		account_scan_start_height,
		transaction_height,
		blockchain_height,
		transactions: normalizedTransactions,
	};
}

/**
 * @description Go through each (possibly) unspent out and remove ones that have been spent before
 * by computing a key image per unspent output and checking if they match any spend_key_images
 * @param {string} address
 * @param {KeyImageCache} [keyImageCache=getKeyImageCache(address)]
 * @param {UnspentOuts} data
 * @param {string} privViewKey
 * @param {string} pubSpendKey
 * @param {string} privSpendKey
 */
export async function parseUnspentOutputs(
	address: string,
	data: UnspentOuts,
	privViewKey: string,
	pubSpendKey: string,
	privSpendKey: string,
	hwdev: HWDevice,
	keyImageCache: KeyImageCache = getKeyImageCache(address),
) {
	JSONPrettyPrint(
		"parseUnspentOutputs",
		{
			address,
			data,
			privViewKey,
			pubSpendKey,
			privSpendKey,
			keyImageCache,
		},
		"args",
	);
	const { outputs, per_kb_fee } = data;
	const nonNullOutputs = outputs || [];

	if (!per_kb_fee) {
		throw Error("Unexpected / missing per_kb_fee");
	}

	const unspentOutputs = await nonNullOutputs.reduce(
		async (unspent, currOutput, i) => {
			const resolvedUnspent = await unspent;

			validateUnspentOutput(currOutput, i);
			validTxPubKey(currOutput);

			const { spend_key_images, tx_pub_key, index } = currOutput;
			validateSpendKeyImages(spend_key_images, i);

			const computedKeyImage = await genKeyImageFromTx(
				keyImageCache,
				tx_pub_key,
				index,
				address,
				privViewKey,
				pubSpendKey,
				privSpendKey,
				hwdev,
			);

			for (const spend_key_image of spend_key_images) {
				if (spend_key_image === computedKeyImage) {
					return resolvedUnspent;
				} else {
					console.log(
						`💬  Output used as mixin (${computedKeyImage} / ${spend_key_image})`,
					);
				}
			}

			return [...resolvedUnspent, currOutput];
		},
		Promise.resolve([]) as Promise<Output[]>,
	);

	console.log("Unspent outs: " + JSON.stringify(unspentOutputs));

	JSONPrettyPrint(
		"parseUnspentOutputs",
		{
			unspentOutputs,
			unusedOuts: [...unspentOutputs],
			per_kb_fee: new BigInt(per_kb_fee),
		},
		"ret",
	);

	return {
		unspentOutputs,
		unusedOuts: [...unspentOutputs],
		per_kb_fee: new BigInt(per_kb_fee),
	};
}
