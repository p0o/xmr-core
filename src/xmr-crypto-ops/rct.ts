import {
	ge_double_scalarmult_base_vartime,
	sc_sub,
	sc_add,
} from "./primitive_ops";
import { H, I } from "./constants";
import { valid_hex } from "xmr-str-utils/hex-strings";
import { hash_to_scalar } from "./hash_ops";
import { Commit, Keys } from "xmr-types";
import { HWDevice } from "xmr-device/types";

//creates a Pedersen commitment from an amount (in scalar form) and a mask
//C = bG + aH where b = mask, a = amount
export function commit(amount: string, mask: string) {
	if (
		!valid_hex(mask) ||
		mask.length !== 64 ||
		!valid_hex(amount) ||
		amount.length !== 64
	) {
		throw Error("invalid amount or mask!");
	}
	const C = ge_double_scalarmult_base_vartime(amount, H, mask);
	return C;
}

export function zeroCommit(amount: string) {
	return commit(amount, I);
}

export function decode_ecdh(ecdh: Commit, key: string): Commit {
	const first = hash_to_scalar(key);
	const second = hash_to_scalar(first);
	return {
		mask: sc_sub(ecdh.mask, first),
		amount: sc_sub(ecdh.amount, second),
	};
}

export function encode_ecdh(ecdh: Commit, key: string): Commit {
	const first = hash_to_scalar(key);
	const second = hash_to_scalar(first);
	return {
		mask: sc_add(ecdh.mask, first),
		amount: sc_add(ecdh.amount, second),
	};
}

export async function generate_key_image_helper(
	keys: Keys,
	tx_pub_key: string,
	out_index: number,
	enc_mask: string | null | undefined,
	hwdev: HWDevice,
) {
	const recv_derivation = await hwdev.generate_key_derivation(
		tx_pub_key,
		keys.view.sec,
	);
	if (!recv_derivation) throw Error("Failed to generate key image");
	// wallet2::light_wallet_parse_rct_str
	const mask = enc_mask
		? sc_sub(
				enc_mask,
				hash_to_scalar(
					await hwdev.derivation_to_scalar(
						recv_derivation,
						out_index,
					),
				),
		  )
		: I; //decode mask, or d2s(1) if no mask
	const ephemeral_pub = await hwdev.derive_public_key(
		recv_derivation,
		out_index,
		keys.spend.pub,
	);
	if (!ephemeral_pub) throw Error("Failed to generate key image");
	const ephemeral_sec = await hwdev.derive_secret_key(
		recv_derivation,
		out_index,
		keys.spend.sec,
	);
	const key_image = await hwdev.generate_key_image(
		ephemeral_pub,
		ephemeral_sec,
	);

	return {
		in_ephemeral: {
			pub: ephemeral_pub,
			sec: ephemeral_sec,
			mask,
		},
		key_image,
	};
}
