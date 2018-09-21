import { randomBytes } from "crypto";
import { padLeft } from "xmr-str-utils/src/std-strings";
import { skGen } from "xmr-crypto-utils/src";
import {
	ge_scalarmult_base,
	ge_add,
	ge_sub,
} from "xmr-crypto-utils/src/crypto-ops/primitive_ops";
import { H2 } from "xmr-crypto-utils/src/crypto-ops/constants";

function randomBit() {
	// get random 8 bits in hex
	const rand8bits = randomBytes(1).toString("hex");
	// take 4 bits "nibble" and convert to binary
	// then take last index
	return padLeft(parseInt(rand8bits[0], 16).toString(2), 4, "0")[3];
}

//Tests for Borromean signatures
//#boro true one, false one, C != sum Ci, and one out of the range..
let xv: string[] = [], // vector of secret keys, 1 per ring (nrings)
	P1v: string[] = [], //key64, arr of commitments Ci
	P2v: string[] = [], //key64
	indi: string[] = []; // vector of secret indexes, 1 per ring (nrings), can be a string

let generated = false;

export function generate_parameters() {
	if (generated) {
		const indiCopy = [...indi];

		return { xv, P1v, P2v, indi: indiCopy };
	} else {
		for (let j = 0; j < 64; j++) {
			indi[j] = randomBit(); /*?.*/

			xv[j] = skGen(); /*?.*/

			if (+indi[j] === 0) {
				P1v[j] = ge_scalarmult_base(xv[j]); /*?.*/
			} else {
				P1v[j] = ge_scalarmult_base(xv[j]); // calculate aG = xv[j].G /*?.*/
				P1v[j] = ge_add(P1v[j], H2[j]); // calculate aG + H2 /*?.*/
			}

			P2v[j] = ge_sub(P1v[j], H2[j]); /*?.*/
		}
		generated = true;
		return { xv, P1v, P2v, indi };
	}
}
