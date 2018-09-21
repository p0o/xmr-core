import { BigInt } from "@xmr-core/biginteger";
import { rctOps, NetType, Keys, constants } from "@xmr-core/xmr-crypto-utils";
import { d2s, JSONPrettyPrint } from "@xmr-core/xmr-str-utils";
import { INTEGRATED_ID_SIZE } from "@xmr-core/xmr-constants";
import { decode_address, is_subaddress } from "@xmr-core/xmr-crypto-utils";
import { formatMoney, formatMoneyFull } from "@xmr-core/xmr-money";
import {
	get_payment_id_nonce,
	add_nonce_to_extra,
	abs_to_rel_offsets,
	add_pub_key_to_extra,
	get_tx_prefix_hash,
} from "./libs/utils";
import { generate_ring_signature } from "./libs/non-ringct";
import { genRct } from "./libs/ringct";
import { HWDevice, DeviceMode } from "@xmr-core/xmr-crypto-utils";
import {
	ViewSendKeys,
	ParsedTarget,
	Output,
	AmountOutput,
	Pid,
	SignedTransaction,
	TransactionOutput,
	SecretCommitment,
	RingMember,
} from "./types";
const { I } = constants;
const { generate_key_image_helper, zeroCommit } = rctOps;

const UINT64_MAX = new BigInt(2).pow(64);

interface SourceOutput {
	index: string;
	key: string;
	commit?: string;
}

interface Source {
	amount: string; //money
	outputs: SourceOutput[]; //index + key + optional ringct commitment
	real_output_pub_tx_key: string; //incoming real tx public key
	real_output_index: number; //index in outputs vector of real output_entry
	real_output_in_tx_index: number; //index in transaction outputs vector
	mask?: string | null; //ringct amount mask
}

export async function create_transaction(
	pub_keys: ViewSendKeys,
	sec_keys: ViewSendKeys,
	dsts: ParsedTarget[],
	outputs: Output[],
	mix_outs: AmountOutput[] | undefined,
	fake_outputs_count: number,
	fee_amount: BigInt,
	payment_id: Pid,
	pid_encrypt: boolean,
	destViewKeyPub: string | undefined,
	unlock_time: number,
	rct: boolean,
	nettype: NetType,
	hwdev: HWDevice,
) {
	JSONPrettyPrint(
		"create_transaction",

		{
			pub_keys,
			sec_keys,
			dsts,
			outputs,
			mix_outs,
			fake_outputs_count,
			fee_amount,
			payment_id,
			pid_encrypt,
			destViewKeyPub,
			unlock_time,
			rct,
			nettype,
		},
		"args",
	);

	unlock_time = unlock_time || 0;
	mix_outs = mix_outs || [];
	let i, j;
	if (dsts.length === 0) {
		throw Error("Destinations empty");
	}
	if (mix_outs.length !== outputs.length && fake_outputs_count !== 0) {
		throw Error(
			"Wrong number of mix outs provided (" +
				outputs.length +
				" outputs, " +
				mix_outs.length +
				" mix outs)",
		);
	}
	for (i = 0; i < mix_outs.length; i++) {
		if ((mix_outs[i].outputs || []).length < fake_outputs_count) {
			throw Error("Not enough outputs to mix with");
		}
	}
	const keys: Keys = {
		view: {
			pub: pub_keys.view,
			sec: sec_keys.view,
		},
		spend: {
			pub: pub_keys.spend,
			sec: sec_keys.spend,
		},
	};
	if (
		!(await hwdev.verify_keys(keys.view.sec, keys.view.pub)) ||
		!(await hwdev.verify_keys(keys.spend.sec, keys.spend.pub))
	) {
		throw Error("Invalid secret keys!");
	}
	let needed_money = BigInt.ZERO;
	for (i = 0; i < dsts.length; ++i) {
		needed_money = needed_money.add(dsts[i].amount);
		if (needed_money.compare(UINT64_MAX) !== -1) {
			throw Error("Output overflow!");
		}
	}
	let found_money = BigInt.ZERO;
	const sources = [];
	console.log("Selected transfers: ", outputs);

	for (i = 0; i < outputs.length; ++i) {
		found_money = found_money.add(outputs[i].amount);
		if (found_money.compare(UINT64_MAX) !== -1) {
			throw Error("Input overflow!");
		}

		const src: Source = {
			amount: outputs[i].amount,
			outputs: [],
			real_output_index: 0,
			real_output_in_tx_index: 0,
			real_output_pub_tx_key: "",
		};

		if (mix_outs.length !== 0) {
			// Sort fake outputs by global index
			mix_outs[i].outputs.sort(function(a, b) {
				return new BigInt(a.global_index).compare(b.global_index);
			});
			j = 0;
			while (
				src.outputs.length < fake_outputs_count &&
				j < mix_outs[i].outputs.length
			) {
				const out = mix_outs[i].outputs[j];
				if (+out.global_index === outputs[i].global_index) {
					console.log("got mixin the same as output, skipping");
					j++;
					continue;
				}

				const output_entry: SourceOutput = {
					index: out.global_index,
					key: out.public_key,
				};

				if (rct) {
					if (out.rct) {
						output_entry.commit = out.rct.slice(0, 64); //add commitment from rct mix outs
					} else {
						if (outputs[i].rct) {
							throw Error("mix rct outs missing commit");
						}
						output_entry.commit = zeroCommit(d2s(src.amount)); //create identity-masked commitment for non-rct mix input
					}
				}
				src.outputs.push(output_entry);
				j++;
			}
		}
		const real_output_entry: SourceOutput = {
			index: outputs[i].global_index.toString(),
			key: outputs[i].public_key,
		};

		if (rct) {
			if (outputs[i].rct) {
				real_output_entry.commit = outputs[i].rct.slice(0, 64); //add commitment for real input
			} else {
				real_output_entry.commit = zeroCommit(d2s(src.amount)); //create identity-masked commitment for non-rct input
			}
		}

		let real_index = src.outputs.length;
		for (j = 0; j < src.outputs.length; j++) {
			if (
				new BigInt(real_output_entry.index).compare(
					src.outputs[j].index,
				) < 0
			) {
				real_index = j;
				break;
			}
		}
		// Add real_oe to outputs
		src.outputs.splice(real_index, 0, real_output_entry);
		src.real_output_pub_tx_key = outputs[i].tx_pub_key;
		// Real output entry index
		src.real_output_index = real_index;
		src.real_output_in_tx_index = outputs[i].index;
		if (rct) {
			// if rct, slice encrypted, otherwise will be set by generate_key_image_helper
			src.mask = outputs[i].rct ? outputs[i].rct.slice(64, 128) : null;
		}
		sources.push(src);
	}
	console.log("sources: ", sources);
	const change = {
		amount: BigInt.ZERO,
	};
	const cmp = needed_money.compare(found_money);
	if (cmp < 0) {
		change.amount = found_money.subtract(needed_money);
		if (change.amount.compare(fee_amount) !== 0) {
			throw Error("early fee calculation != later");
		}
	} else if (cmp > 0) {
		throw Error("Need more money than found! (have: ") +
			formatMoney(found_money) +
			" need: " +
			formatMoney(needed_money) +
			")";
	}
	await hwdev.set_mode(DeviceMode.TRANSACTION_CREATE_REAL);
	return construct_tx(
		keys,
		sources,
		dsts,
		fee_amount,
		payment_id,
		pid_encrypt,
		destViewKeyPub,
		unlock_time,
		rct,
		nettype,
		hwdev,
	);
}

export async function construct_tx(
	keys: Keys,
	sources: Source[],
	dsts: ParsedTarget[],
	fee_amount: BigInt,
	payment_id: string | null,
	pid_encrypt: boolean,
	destViewKeyPub: string | undefined,
	unlock_time: number,
	rct: boolean,
	nettype: NetType,
	hwdev: HWDevice,
) {
	JSONPrettyPrint(
		"construct_tx",
		{
			keys,
			sources,
			dsts,
			fee_amount,
			payment_id,
			pid_encrypt,
			destViewKeyPub,
			unlock_time,
			rct,
			nettype,
		},
		"args",
	);

	//we move payment ID stuff here, because we need txkey to encrypt
	const txkey = { sec: await hwdev.open_tx(), pub: "" };

	let extra = "";
	if (payment_id) {
		if (pid_encrypt && payment_id.length !== INTEGRATED_ID_SIZE * 2) {
			throw Error(
				"payment ID must be " +
					INTEGRATED_ID_SIZE +
					" bytes to be encrypted!",
			);
		}
		console.log("Adding payment id: " + payment_id);
		if (pid_encrypt) {
			if (!destViewKeyPub) {
				throw Error("destViewKeyPub not found");
			}

			payment_id = await hwdev.encrypt_payment_id(
				payment_id,
				destViewKeyPub,
				txkey.sec,
			);
		}

		const nonce = get_payment_id_nonce(payment_id, pid_encrypt);
		console.log("Extra nonce: " + nonce);
		extra = add_nonce_to_extra(extra, nonce);
	}

	const CURRENT_TX_VERSION = 2;
	const OLD_TX_VERSION = 1;

	const tx: SignedTransaction = {
		unlock_time,
		version: rct ? CURRENT_TX_VERSION : OLD_TX_VERSION,
		extra,
		vin: [],
		vout: [],
		rct_signatures: undefined,
		signatures: undefined,
	};

	const inputs_money = sources.reduce<BigInt>(
		(totalAmount, { amount }) => totalAmount.add(amount),
		BigInt.ZERO,
	);

	let i;
	console.log("Sources: ");

	//run the for loop twice to sort ins by key image
	//first generate key image and other construction data to sort it all in one go

	type KeyImgAndKeys = {
		key_image: string;
		in_ephemeral: {
			pub: string;
			sec: string;
			mask: string;
		};
	};

	const sourcesWithKeyImgAndKeys: (Source & KeyImgAndKeys)[] = [];

	let _i = 0;
	for (const source of sources) {
		console.log(_i + ": " + formatMoneyFull(source.amount));
		if (source.real_output_index >= source.outputs.length) {
			throw Error("real index >= outputs.length");
		}
		const { key_image, in_ephemeral } = await generate_key_image_helper(
			keys,
			source.real_output_pub_tx_key,
			source.real_output_in_tx_index,
			source.mask,
			hwdev,
		); //mask will be undefined for non-rct

		if (in_ephemeral.pub !== source.outputs[source.real_output_index].key) {
			throw Error("in_ephemeral.pub !== source.real_out.key");
		}

		const newSrc: Source & KeyImgAndKeys = {
			...source,
			key_image,
			in_ephemeral,
		};
		sourcesWithKeyImgAndKeys.push(newSrc);
		_i++;
	}

	JSONPrettyPrint(
		"construct_tx",
		{
			sourcesWithKeyImgAndKeys,
		},
		"sourcesWithKeyImgAndKeys_pre_sort",
	);

	//sort ins
	sourcesWithKeyImgAndKeys.sort((a, b) => {
		return (
			BigInt.parse(a.key_image, 16).compare(
				BigInt.parse(b.key_image, 16),
			) * -1
		);
	});

	JSONPrettyPrint(
		"construct_tx",
		{
			sourcesWithKeyImgAndKeys,
		},
		"sourcesWithKeyImgAndKeys_post_sort",
	);

	const in_contexts = sourcesWithKeyImgAndKeys.map(
		source => source.in_ephemeral,
	);

	//copy the sorted sourcesWithKeyImgAndKeys data to tx
	tx.vin = sourcesWithKeyImgAndKeys.map(source => {
		const input_to_key = {
			type: "input_to_key",
			amount: source.amount,
			k_image: source.key_image,
			key_offsets: source.outputs.map(s => s.index),
		};

		input_to_key.key_offsets = abs_to_rel_offsets(input_to_key.key_offsets);
		return input_to_key;
	});

	const dstsWithKeys = dsts.map(d => {
		if (d.amount.compare(0) < 0) {
			throw Error("dst.amount < 0"); //amount can be zero if no change
		}
		const pubkeys = decode_address(d.address, nettype);
		return { ...d, pubkeys };
	});

	const outputs_money = dstsWithKeys.reduce<BigInt>(
		(outputs_money, { amount }) => outputs_money.add(amount),
		BigInt.ZERO,
	);

	interface Ret {
		amountKeys: string[];
		vout: TransactionOutput[];
	}

	const ret: Ret = { amountKeys: [], vout: [] };
	//amountKeys is rct only
	const { amountKeys, vout } = await dstsWithKeys.reduce<Promise<Ret>>(
		async (accu, dstWKey, output_index) => {
			const { amountKeys, vout } = await accu;

			// R = rD for subaddresses
			if (is_subaddress(dstWKey.address, nettype)) {
				if (payment_id) {
					// this could stand to be placed earlier in the function but we save repeating a little algo time this way
					throw Error(
						"Payment ID must not be supplied when sending to a subaddress",
					);
				}
				txkey.pub = await hwdev.scalarmultKey(
					dstWKey.pubkeys.spend,
					txkey.sec,
				);
			} else {
				txkey.pub = await hwdev.scalarmultBase(txkey.sec);
			}

			const output_derivation =
				dstWKey.pubkeys.view === keys.view.pub
					? await hwdev.generate_key_derivation(
							txkey.pub,
							keys.view.sec,
					  ) // send change to ourselves, derivation = a*R
					: await hwdev.generate_key_derivation(
							dstWKey.pubkeys.view,
							txkey.sec,
					  ); // sending to the recipient, derivation = r*A (or s*C in the subaddress scheme)

			const out_eph_public_key = await hwdev.derive_public_key(
				output_derivation,
				output_index,
				dstWKey.pubkeys.spend,
			);

			const out = {
				amount: dstWKey.amount.toString(),
				// txout_to_key
				target: {
					type: "txout_to_key",
					key: out_eph_public_key,
				},
			};
			// cryptonote_tx_utils L#413
			const nextAmountKeys = rct
				? [
						...amountKeys,
						await hwdev.derivation_to_scalar(
							output_derivation,
							output_index,
						),
				  ]
				: amountKeys;

			hwdev.add_output_key_mapping(
				dstWKey.pubkeys.view,
				dstWKey.pubkeys.spend,
				is_subaddress(dstWKey.address, nettype),
				output_index,
				nextAmountKeys[nextAmountKeys.length - 1],
				out_eph_public_key,
			);

			const nextVout = [...vout, out];
			const nextVal: Ret = { amountKeys: nextAmountKeys, vout: nextVout };
			return nextVal;
		},
		Promise.resolve(ret),
	);

	tx.vout = vout;

	// add pub key to extra after we know whether to use R = rG or R = rD
	tx.extra = add_pub_key_to_extra(tx.extra, txkey.pub);

	if (outputs_money.add(fee_amount).compare(inputs_money) > 0) {
		throw Error(
			`outputs money:${formatMoneyFull(
				outputs_money,
			)} + fee:${formatMoneyFull(
				fee_amount,
			)} > inputs money:${formatMoneyFull(inputs_money)}`,
		);
	}

	if (!rct) {
		const signatures = sourcesWithKeyImgAndKeys.map((src, i) => {
			const src_keys = src.outputs.map(s => s.key);
			const sigs = generate_ring_signature(
				get_tx_prefix_hash(tx),
				tx.vin[i].k_image,
				src_keys,
				in_contexts[i].sec,
				sourcesWithKeyImgAndKeys[i].real_output_index,
			);
			return sigs;
		});
		tx.signatures = signatures;
	} else {
		//rct
		const keyimages: string[] = [];
		const inSk: SecretCommitment[] = [];
		const inAmounts: string[] = [];
		const mixRing: RingMember[][] = [];
		const indices: number[] = [];

		tx.vin.forEach((input, i) => {
			keyimages.push(input.k_image);

			inSk.push({
				x: in_contexts[i].sec,
				a: in_contexts[i].mask,
			});
			inAmounts.push(input.amount);

			if (in_contexts[i].mask !== I) {
				//if input is rct (has a valid mask), 0 out amount
				input.amount = "0";
			}

			mixRing[i] = sourcesWithKeyImgAndKeys[i].outputs.map(o => {
				if (!o.commit) {
					throw Error("Commit not found");
				}
				return {
					dest: o.key,
					mask: o.commit,
				};
			});

			indices.push(sourcesWithKeyImgAndKeys[i].real_output_index);
		});

		const destinations: string[] = [];
		const outAmounts = [];
		for (i = 0; i < tx.vout.length; i++) {
			destinations.push(tx.vout[i].target.key);
			outAmounts.push(tx.vout[i].amount);
			tx.vout[i].amount = "0"; //zero out all rct outputs
		}
		JSONPrettyPrint(
			"construct_tx",
			{
				tx,
				keyimages,
				inSk,
				inAmounts,
				mixRing,
				indices,
				destinations,
				outAmounts,
			},
			"pre_gen_rct",
		);

		const tx_prefix_hash = get_tx_prefix_hash(tx);
		tx.rct_signatures = await genRct(
			tx_prefix_hash,
			inSk,
			keyimages,
			destinations,
			inAmounts,
			outAmounts,
			mixRing,
			amountKeys,
			indices,
			fee_amount.toString(),
			hwdev,
		);
	}

	JSONPrettyPrint(
		"construct_tx",
		{
			tx,
		},
		"ret",
	);

	await hwdev.close_tx();

	return tx;
}
