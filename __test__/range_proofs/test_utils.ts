import { randomBytes } from "crypto";
import { SecretCommitment, RingMember } from "@xmr-core/xmr-transaction";
import { random_keypair } from "@xmr-core/xmr-crypto-utils";
import { d2s } from "@xmr-core/xmr-str-utils";
import {
	ge_scalarmult,
	ge_add,
} from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/primitive_ops";
import { H } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/constants";

//generates a <secret , public> / Pedersen commitment to the amount

export function ctskpkGen(amount: number): [SecretCommitment, RingMember] {
	let sk = { x: "", a: "" },
		pk = { dest: "", mask: "" };
	const key_pair1 = random_keypair();
	const key_pair2 = random_keypair();

	sk.x = key_pair1.sec;
	pk.dest = key_pair1.pub;

	sk.a = key_pair2.sec;
	pk.mask = key_pair2.pub;
	const am = d2s(amount.toString());
	const bH = ge_scalarmult(H, am);

	pk.mask = ge_add(pk.mask, bH);

	return [sk, pk];
}

export function randomNum(upperLimit: number) {
	return parseInt(randomBytes(1).toString("hex"), 16) % upperLimit;
}

// These functions get keys from blockchain
// replace these when connecting blockchain
// getKeyFromBlockchain grabs a key from the blockchain at "reference_index" (unused param) to mix with
export function getKeyFromBlockchain() {
	let a = { dest: "", mask: "" };
	a.dest = random_keypair().pub;
	a.mask = random_keypair().pub;
	return a;
}

//	populateFromBlockchain creates a keymatrix with "mixin" + 1 columns and one of the columns is inPk
//  the return values are the key matrix, and the index where inPk was put (random).
export function populateFromBlockchain(inPk: RingMember[], mixin: number) {
	const rows = inPk.length;
	const inPkCpy = [...inPk];
	// ctkeyMatrix
	const mixRing: RingMember[][] = [];
	const index = randomNum(mixin);

	for (let i = 0; i < rows; i++) {
		mixRing[i] = [];
		for (let j = 0; j <= mixin; j++) {
			if (j !== index) {
				mixRing[i][j] = getKeyFromBlockchain(); /*?*/
			} else {
				mixRing[i][j] = inPkCpy.pop() as RingMember;
			}
		}
	}

	return { mixRing, index };
}

export function populateFromBlockchainSimple(inPk: RingMember, mixin: number) {
	const index = randomNum(mixin);
	const mixRing = [];

	for (let i = 0; i <= mixin; i++) {
		if (i !== index) {
			mixRing[i] = getKeyFromBlockchain();
		} else {
			mixRing[i] = inPk;
		}
	}

	return { mixRing, index };
}
