// Copyright (c) 2014-2018, MyMonero.com
//
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification, are
// permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of
//	conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list
//	of conditions and the following disclaimer in the documentation and/or other
//	materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its contributors may be
//	used to endorse or promote products derived from this software without specific
//	prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL
// THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
// STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
// THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { JSBigInt, Omit } from "types";
import monero_utils from "../monero_utils/monero_cryptonote_utils_instance";
import { genKeyImage, KeyImageCache } from "../monero_utils/key_image_utils";

function Parsed_AddressInfo__sync(
	keyImage_cache,
	data,
	address,
	view_key__private,
	spend_key__public,
	spend_key__private,
) {
	// -> returnValuesByKey
	const total_received = new JSBigInt(data.total_received || 0);
	const locked_balance = new JSBigInt(data.locked_funds || 0);
	var total_sent = new JSBigInt(data.total_sent || 0); // will be modified in place
	//
	const account_scanned_tx_height = data.scanned_height || 0;
	const account_scanned_block_height = data.scanned_block_height || 0;
	const account_scan_start_height = data.start_height || 0;
	const transaction_height = data.transaction_height || 0;
	const blockchain_height = data.blockchain_height || 0;
	const spent_outputs = data.spent_outputs || [];
	//
	for (let spent_output of spent_outputs) {
		var key_image = key_image_utils.keyImage(
			keyImage_cache,
			spent_output.tx_pub_key,
			spent_output.out_index,
			address,
			view_key__private,
			spend_key__public,
			spend_key__private,
		);
		if (spent_output.key_image !== key_image) {
			// console.log('💬  Output used as mixin (' + spent_output.key_image + '/' + key_image + ')')
			total_sent = new JSBigInt(total_sent).subtract(spent_output.amount);
		}
	}
	//
	const ratesBySymbol = data.rates || {}; // jic it's not there
	//
	const returnValuesByKey = {
		total_received_String: total_received
			? total_received.toString()
			: null,
		locked_balance_String: locked_balance
			? locked_balance.toString()
			: null,
		total_sent_String: total_sent ? total_sent.toString() : null,
		// ^serialized JSBigInt
		spent_outputs: spent_outputs,
		account_scanned_tx_height: account_scanned_tx_height,
		account_scanned_block_height: account_scanned_block_height,
		account_scan_start_height: account_scan_start_height,
		transaction_height: transaction_height,
		blockchain_height: blockchain_height,
		//
		ratesBySymbol: ratesBySymbol,
	};
	return returnValuesByKey;
}
function Parsed_AddressInfo__sync__keyImageManaged(
	data,
	address,
	view_key__private,
	spend_key__public,
	spend_key__private,
) {
	// -> returnValuesByKey
	const keyImageCache = key_image_utils.getKeyImageCache(address);
	return Parsed_AddressInfo__sync(
		keyImageCache,
		data,
		address,
		view_key__private,
		spend_key__public,
		spend_key__private,
	);
}
function Parsed_AddressInfo(
	keyImage_cache,
	data,
	address,
	view_key__private,
	spend_key__public,
	spend_key__private,
	fn, // (err?, returnValuesByKey) -> Void
) {
	const returnValuesByKey = Parsed_AddressInfo__sync(
		keyImage_cache,
		data,
		address,
		view_key__private,
		spend_key__public,
		spend_key__private,
	);
	fn(null, returnValuesByKey);
}
function Parsed_AddressInfo__keyImageManaged(
	data,
	address,
	view_key__private,
	spend_key__public,
	spend_key__private,
	fn,
) {
	// -> returnValuesByKey
	Parsed_AddressInfo(
		key_image_utils.getKeyImageCache(address),
		data,
		address,
		view_key__private,
		spend_key__public,
		spend_key__private,
		fn,
	);
}
exports.Parsed_AddressInfo = Parsed_AddressInfo;
exports.Parsed_AddressInfo__keyImageManaged = Parsed_AddressInfo__keyImageManaged; // in case you can't send a mutable key image cache dictionary
exports.Parsed_AddressInfo__sync__keyImageManaged = Parsed_AddressInfo__sync__keyImageManaged; // in case you can't send a mutable key image cache dictionary
exports.Parsed_AddressInfo__sync = Parsed_AddressInfo__sync;

function Parsed_AddressTransactions(
	keyImage_cache,
	data,
	address,
	view_key__private,
	spend_key__public,
	spend_key__private,
	fn, // (err?, returnValuesByKey) -> Void
) {
	const returnValuesByKey = Parsed_AddressTransactions__sync(
		keyImage_cache,
		data,
		address,
		view_key__private,
		spend_key__public,
		spend_key__private,
	);
	fn(null, returnValuesByKey);
}

interface SpentOutput {
	amount: string;
	key_image: string;
	tx_pub_key: string;
	out_index: number;
	mixin?: number;
}

interface AddressTransactionsTx {
	id: number;
	hash?: string;
	timestamp?: string;
	total_received?: string;
	total_sent?: string;
	unlock_time?: number;
	height?: number;
	coinbase?: boolean;
	mempool?: boolean;
	mixin?: number;
	spent_outputs?: SpentOutput[];
	payment_id?: string;
}

interface AddressTransactions {
	total_received?: string;
	scanned_height?: number;
	scanned_block_height?: number;
	start_height?: number;
	transaction_height?: number;
	blockchain_height?: number;
	transactions?: AddressTransactionsTx[];
}

function normalizeAddressTransactions(
	data: AddressTransactions,
): Required<AddressTransactions> {
	const defaultObj: Required<AddressTransactions> = {
		scanned_height: 0,
		scanned_block_height: 0,
		start_height: 0,
		transaction_height: 0,
		blockchain_height: 0,
		transactions: [] as AddressTransactionsTx[],
		total_received: "0",
	};
	return { ...defaultObj, ...data };
}

interface NormalizedTransaction extends Required<AddressTransactionsTx> {
	amount: string;
	approx_float_amount: number;
}

function normalizeTransaction(
	tx: AddressTransactionsTx,
): NormalizedTransaction {
	const defaultObj: NormalizedTransaction = {
		amount: "0",
		approx_float_amount: 0,
		hash: "",
		height: 0,
		id: 0,
		mempool: false,
		coinbase: false,
		mixin: 0,
		spent_outputs: [] as SpentOutput[],
		timestamp: "",
		total_received: "0",
		total_sent: "0",
		unlock_time: 0,
		payment_id: "",
	};

	const mergedObj = { ...defaultObj, ...tx };

	return mergedObj;
}

function isKeyImageEqual({ key_image }: SpentOutput, keyImage: string) {
	return key_image === keyImage;
}

/**
 *
 * @description Validates that the sum of total received and total sent is greater than 1
 * @param {NormalizedTransaction} { total_received, total_sent}
 */
function zeroTransactionAmount({
	total_received,
	total_sent,
}: NormalizedTransaction) {
	return new JSBigInt(total_received).add(total_sent).compare(0) <= 0;
}

function calculateTransactionAmount({
	total_received,
	total_sent,
}: NormalizedTransaction) {
	return new JSBigInt(total_received).subtract(total_sent).toString();
}

function estimateTransactionAmount({ amount }: NormalizedTransaction) {
	return parseFloat(monero_utils.formatMoney(amount));
}

function Parsed_AddressTransactions__sync(
	keyImage_cache: KeyImageCache,
	data: AddressTransactions,
	address: string,
	privViewKey: string,
	pubSpendKey: string,
	spend_key__private: string,
) {
	const {
		blockchain_height,
		scanned_block_height: account_scanned_block_height,
		scanned_height: account_scanned_height,
		start_height: account_scan_start_height,
		total_received,
		transaction_height,
		transactions,
	} = normalizeAddressTransactions(data);

	// TODO: rewrite this with more clarity if possible
	for (let i = 0; i < transactions.length; ++i) {
		const transaction = normalizeTransaction(transactions[i]);

		for (let j = 0; j < transaction.spent_outputs.length; ++j) {
			const keyImage = genKeyImage(
				keyImage_cache,
				transaction.spent_outputs[j].tx_pub_key,
				transaction.spent_outputs[j].out_index,
				address,
				privViewKey,
				pubSpendKey,
				spend_key__private,
			);

			if (!isKeyImageEqual(transaction.spent_outputs[j], keyImage)) {
				// console.log('Output used as mixin, ignoring (' + transaction.spent_outputs[j].key_image + '/' + key_image + ')')
				transaction.total_sent = new JSBigInt(transaction.total_sent)
					.subtract(transaction.spent_outputs[j].amount)
					.toString();

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

		const record__payment_id = transaction.payment_id;

		const outgoingTxWithEncPid =
			record__payment_id &&
			record__payment_id.length === 16 &&
			transaction.approx_float_amount < 0;
		if (outgoingTxWithEncPid) {
			delete transaction.payment_id; // need to filter these out .. because the server can't filter out short (encrypted) pids on outgoing txs
		}
	}

	transactions.sort((a, b) => {
		if (a.mempool) {
			if (!b.mempool) {
				return -1; // a first
			}
			// both mempool - fall back to .id compare
		} else if (b.mempool) {
			return 1; // b first
		}
		return b.id - a.id;
	});

	// on the other side, we convert transactions timestamp to Date obj

	return {
		account_scanned_height,
		account_scanned_block_height,
		account_scan_start_height,
		transaction_height,
		blockchain_height,
		serialized_transactions: transactions,
	};
}

function Parsed_AddressTransactions__sync__keyImageManaged(
	data,
	address,
	view_key__private,
	spend_key__public,
	spend_key__private,
) {
	const keyImageCache = key_image_utils.getKeyImageCache(address);
	return Parsed_AddressTransactions__sync(
		keyImageCache,
		data,
		address,
		view_key__private,
		spend_key__public,
		spend_key__private,
	);
}
function Parsed_AddressTransactions__keyImageManaged(
	data,
	address,
	view_key__private,
	spend_key__public,
	spend_key__private,
	fn,
) {
	Parsed_AddressTransactions(
		key_image_utils.getKeyImageCache(address),
		data,
		address,
		view_key__private,
		spend_key__public,
		spend_key__private,
		fn,
	);
}
exports.Parsed_AddressTransactions = Parsed_AddressTransactions;
exports.Parsed_AddressTransactions__keyImageManaged = Parsed_AddressTransactions__keyImageManaged;
exports.Parsed_AddressTransactions__sync = Parsed_AddressTransactions__sync;
exports.Parsed_AddressTransactions__sync__keyImageManaged = Parsed_AddressTransactions__sync__keyImageManaged;
//
function Parsed_UnspentOuts(
	keyImage_cache,
	data,
	address,
	view_key__private,
	spend_key__public,
	spend_key__private,
	fn, // (err?, returnValuesByKey)
) {
	const returnValuesByKey = Parsed_UnspentOuts__sync(
		keyImage_cache,
		data,
		address,
		view_key__private,
		spend_key__public,
		spend_key__private,
	);
	fn(null, returnValuesByKey);
}
function Parsed_UnspentOuts__sync(
	keyImage_cache,
	data,
	address,
	view_key__private,
	spend_key__public,
	spend_key__private,
) {
	const data_outputs = data.outputs;
	const finalized_unspentOutputs = data.outputs || []; // to finalize:
	for (var i = 0; i < finalized_unspentOutputs.length; i++) {
		const unspent_output = finalized_unspentOutputs[i];
		if (
			unspent_output === null ||
			typeof unspent_output === "undefined" ||
			!unspent_output // just preserving what was in the original code
		) {
			throw "unspent_output at index " + i + " was null";
		}
		const spend_key_images = unspent_output.spend_key_images;
		if (
			spend_key_images === null ||
			typeof spend_key_images === "undefined"
		) {
			throw "spend_key_images of unspent_output at index " +
				i +
				" was null";
		}
		for (var j = 0; j < spend_key_images.length; j++) {
			const finalized_unspentOutput_atI_beforeSplice =
				finalized_unspentOutputs[i];
			if (
				!finalized_unspentOutput_atI_beforeSplice ||
				typeof finalized_unspentOutput_atI_beforeSplice === "undefined"
			) {
				console.warn(
					`This unspent output at i ${i} was literally undefined! Skipping.`,
				); // NOTE: Looks like the i-- code below should exit earlier if this is necessary
				continue;
			}
			const beforeSplice__tx_pub_key =
				finalized_unspentOutput_atI_beforeSplice.tx_pub_key;
			const beforeSplice__index =
				finalized_unspentOutput_atI_beforeSplice.index;
			if (
				typeof beforeSplice__tx_pub_key === "undefined" ||
				!beforeSplice__tx_pub_key
			) {
				console.warn(
					"This unspent out was missing a tx_pub_key! Skipping.",
					finalized_unspentOutput_atI_beforeSplice,
				);
				continue;
			}
			var key_image = key_image_utils.keyImage(
				keyImage_cache,
				beforeSplice__tx_pub_key,
				beforeSplice__index,
				address,
				view_key__private,
				spend_key__public,
				spend_key__private,
			);
			if (
				key_image ===
				finalized_unspentOutput_atI_beforeSplice.spend_key_images[j]
			) {
				// console.log("💬  Output was spent; key image: " + key_image + " amount: " + monero_utils.formatMoneyFull(finalized_unspentOutputs[i].amount));
				// Remove output from list
				finalized_unspentOutputs.splice(i, 1);
				const finalized_unspentOutput_atI_afterSplice =
					finalized_unspentOutputs[i];
				if (finalized_unspentOutput_atI_afterSplice) {
					j =
						finalized_unspentOutput_atI_afterSplice.spend_key_images
							.length;
				}
				i--;
			} else {
				console.log(
					"💬  Output used as mixin (" +
						key_image +
						"/" +
						finalized_unspentOutputs[i].spend_key_images[j] +
						")",
				);
			}
		}
	}
	console.log("Unspent outs: " + JSON.stringify(finalized_unspentOutputs));
	const unusedOuts = finalized_unspentOutputs.slice(0);
	const returnValuesByKey = {
		unspentOutputs: finalized_unspentOutputs,
		unusedOuts: unusedOuts,
		per_kb_fee: data.per_kb_fee, // String
	};
	return returnValuesByKey;
}
function Parsed_UnspentOuts__sync__keyImageManaged(
	data,
	address,
	view_key__private,
	spend_key__public,
	spend_key__private,
) {
	const keyImageCache = key_image_utils.getKeyImageCache(address);
	return Parsed_UnspentOuts__sync(
		keyImageCache,
		data,
		address,
		view_key__private,
		spend_key__public,
		spend_key__private,
	);
}
function Parsed_UnspentOuts__keyImageManaged(
	data,
	address,
	view_key__private,
	spend_key__public,
	spend_key__private,
	fn,
) {
	Parsed_UnspentOuts(
		key_image_utils.getKeyImageCache(address),
		data,
		address,
		view_key__private,
		spend_key__public,
		spend_key__private,
		fn,
	);
}
exports.Parsed_UnspentOuts = Parsed_UnspentOuts;
exports.Parsed_UnspentOuts__keyImageManaged = Parsed_UnspentOuts__keyImageManaged;
exports.Parsed_UnspentOuts__sync = Parsed_UnspentOuts__sync;
exports.Parsed_UnspentOuts__sync__keyImageManaged = Parsed_UnspentOuts__sync__keyImageManaged;
