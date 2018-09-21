import { BigInt } from "biginteger";
import { skGen } from "@xmr-core/xmr-crypto-utils";
import { d2s } from "@xmr-core/xmr-str-utils";
import {
	encode_ecdh,
	decode_ecdh,
} from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/rct";

it("ecdh_roundtrip", () => {
	const test_amounts = [
		new BigInt(1),
		new BigInt(1),
		new BigInt(2),
		new BigInt(3),
		new BigInt(4),
		new BigInt(5),
		new BigInt(10000),

		new BigInt("10000000000000000000"),
		new BigInt("10203040506070809000"),

		new BigInt("123456789123456789"),
	];

	for (const amount of test_amounts) {
		const k = skGen();
		const scalar = skGen(); /*?*/
		const amt = d2s(amount.toString());
		const t0 = {
			mask: scalar,
			amount: amt,
		};

		// both are strings so we can shallow copy
		let t1 = { ...t0 };

		t1 = encode_ecdh(t1, k);

		t1 = decode_ecdh(t1, k);
		expect(t1.mask).toEqual(t0.mask);
		expect(t1.amount).toEqual(t0.amount);
	}
});
