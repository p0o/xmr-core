import {
	hash_ops,
	primitive_ops,
	random_scalar,
} from "@xmr-core/xmr-crypto-utils";
import { MGSig } from "./types";
import { HWDevice } from "@xmr-core/xmr-crypto-utils";
import { JSONPrettyPrint } from "@xmr-core/xmr-str-utils";

const { array_hash_to_scalar, hashToPoint } = hash_ops;
const {
	ge_scalarmult_base,
	sc_sub,
	ge_double_scalarmult_postcomp_vartime,
	ge_double_scalarmult_base_vartime,
} = primitive_ops;

// Gen creates a signature which proves that for some column in the keymatrix "pk"
//	 the signer knows a secret key for each row in that column
// we presently only support matrices of 2 rows (pubkey, commitment)
// this is a simplied MLSAG_Gen function to reflect that
// because we don't want to force same secret column for all inputs

export async function MLSAG_Gen(
	message: string,
	pk: string[][],
	xx: string[],
	kimg: string,
	index: number,
	hwdev: HWDevice,
) {
	JSONPrettyPrint(
		"MLSAG_Gen",

		{
			message,
			pk,
			xx,
			kimg,
			index,
		},
		"args",
	);
	const cols = pk.length; //ring size
	let i;

	// secret index
	if (index >= cols) {
		throw Error("index out of range");
	}
	const rows = pk[0].length; //number of signature rows (always 2)
	// [pub, com] = 2
	if (rows !== 2) {
		throw Error("wrong row count");
	}
	// check all are len 2
	for (i = 0; i < cols; i++) {
		if (pk[i].length !== rows) {
			throw Error("pk is not rectangular");
		}
	}
	if (xx.length !== rows) {
		throw Error("bad xx size");
	}

	let c_old = "";
	const alpha = [];

	const rv: MGSig = {
		ss: [],
		cc: "",
	};
	for (i = 0; i < cols; i++) {
		rv.ss[i] = [];
	}
	const toHash = []; //holds 6 elements: message, pubkey, dsRow L, dsRow R, commitment, ndsRow L
	toHash[0] = message;

	//secret index (pubkey section)
	const Hi = hashToPoint(pk[index][0]);
	const { a, aG, aHP } = await hwdev.mlsag_prepare(Hi, xx[0]);

	alpha[0] = a; //need to save alphas for later
	toHash[1] = pk[index][0]; //secret index pubkey

	toHash[2] = aG; //dsRow L, a.G
	toHash[3] = aHP; //dsRow R (key image check)

	//secret index (commitment section) / nds rows
	alpha[1] = random_scalar();
	toHash[4] = pk[index][1]; //secret index commitment
	toHash[5] = ge_scalarmult_base(alpha[1]); //ndsRow L

	c_old = await hwdev.mlsag_hash(toHash);

	JSONPrettyPrint(
		"MLSAG_Gen",
		{ alpha, toHash, c_old },
		"secret index section",
	);
	i = (index + 1) % cols;
	if (i === 0) {
		rv.cc = c_old;
	}
	while (i != index) {
		rv.ss[i][0] = random_scalar(); //dsRow ss
		rv.ss[i][1] = random_scalar(); //ndsRow ss

		//!secret index (pubkey section)
		toHash[1] = pk[i][0];
		toHash[2] = ge_double_scalarmult_base_vartime(
			c_old,
			pk[i][0],
			rv.ss[i][0],
		);
		toHash[3] = ge_double_scalarmult_postcomp_vartime(
			rv.ss[i][0],
			pk[i][0],
			c_old,
			kimg,
		);
		//!secret index (commitment section)
		toHash[4] = pk[i][1];
		toHash[5] = ge_double_scalarmult_base_vartime(
			c_old,
			pk[i][1],
			rv.ss[i][1],
		);
		c_old = await hwdev.mlsag_hash(toHash); //hash to get next column c
		i = (i + 1) % cols;
		if (i === 0) {
			rv.cc = c_old;
		}

		JSONPrettyPrint(
			"MLSAG_Gen_post_iteration",
			{ alpha, toHash, c_old },
			`iteration ${i}`,
		);
	}

	await hwdev.mlsag_sign(c_old, xx, alpha, rows, 1, rv.ss[index]);
	JSONPrettyPrint(
		"MLSAG_Gen",

		{
			rv,
		},
		"ret",
	);
	return rv;
}

export function MLSAG_ver(
	message: string,
	pk: string[][],
	rv: MGSig,
	kimg: string,
) {
	// we assume that col, row, rectangular checks are already done correctly
	// in MLSAG_gen
	const cols = pk.length;
	let c_old = rv.cc;
	let i = 0;
	let toHash = [];
	toHash[0] = message;
	while (i < cols) {
		//!secret index (pubkey section)
		toHash[1] = pk[i][0];
		toHash[2] = ge_double_scalarmult_base_vartime(
			c_old,
			pk[i][0],
			rv.ss[i][0],
		);
		toHash[3] = ge_double_scalarmult_postcomp_vartime(
			rv.ss[i][0],
			pk[i][0],
			c_old,
			kimg,
		);

		//!secret index (commitment section)
		toHash[4] = pk[i][1];
		toHash[5] = ge_double_scalarmult_base_vartime(
			c_old,
			pk[i][1],
			rv.ss[i][1],
		);

		c_old = array_hash_to_scalar(toHash);

		i = i + 1;
	}

	const c = sc_sub(c_old, rv.cc);
	console.log(`[MLSAG_ver]
		c_old: ${c_old} 
		rc.cc: ${rv.cc}
		c: ${c}`);

	return Number(c) === 0;
}
