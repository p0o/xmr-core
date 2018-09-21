import { ctskpkGen, populateFromBlockchain } from "./test_utils";
import { BigInt } from "@xmr-core/biginteger";
import { hash_to_scalar } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/hash_ops";
import { Z } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/constants";
import { random_keypair, DefaultDevice } from "@xmr-core/xmr-crypto-utils";
import { generate_key_image } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/key_image";
import { genRct, verRct, decodeRct } from "@xmr-core/xmr-transaction";

it("range_proofs", async () => {
	//Ring CT Stuff
	//ct range proofs
	// ctkey vectors
	let inSk = [],
		inPk = [];

	// ctkeys
	// we test only a single input here since the current impl of
	// MLSAG_gen of type full only supports single inputs
	{
		let [sctmp, pctmp] = ctskpkGen(6000);
		console.log(sctmp, pctmp);
		inSk.push(sctmp);
		inPk.push(pctmp);
		console.log("inPk", inPk);
	}

	// xmr amount vector
	let amounts = [];
	// key vector
	let amount_keys = [];
	const destinations = [];

	// add outputs

	amounts.push(new BigInt(500));
	amount_keys.push(hash_to_scalar(Z));
	destinations.push(random_keypair().pub);

	amounts.push(new BigInt(4500));
	amount_keys.push(hash_to_scalar(Z));
	destinations.push(random_keypair().pub);

	amounts.push(new BigInt(500));
	amount_keys.push(hash_to_scalar(Z));
	destinations.push(random_keypair().pub);

	amounts.push(new BigInt(500));
	amount_keys.push(hash_to_scalar(Z));
	destinations.push(random_keypair().pub);

	//compute rct data with mixin 500
	const { index, mixRing } = populateFromBlockchain(inPk, 3);

	// generate kimg
	const kimg = [generate_key_image(inPk[0].dest, inSk[0].x)];
	const defaultHwDev = new DefaultDevice();

	let s = await genRct(
		Z,
		inSk,
		kimg,
		destinations,
		[],
		amounts,
		mixRing,
		amount_keys,
		[index],
		"0",
		defaultHwDev,
	);

	expect(await verRct(s, true, mixRing, kimg[0])).toEqual(true);
	expect(await verRct(s, false, mixRing, kimg[0])).toEqual(true);

	//decode received amount
	await decodeRct(s, amount_keys[1], 1, defaultHwDev);

	// Ring CT with failing MG sig part should not verify!
	// Since sum of inputs != outputs

	amounts[1] = new BigInt(12501);

	s = await genRct(
		Z,
		inSk,
		kimg,
		destinations,
		[],
		amounts,
		mixRing,
		amount_keys,
		[index],
		"0",
		defaultHwDev,
	);

	expect(await verRct(s, true, mixRing, kimg[0])).toEqual(true);
	expect(await verRct(s, false, mixRing, kimg[0])).toEqual(false);

	//decode received amount
	await decodeRct(s, amount_keys[1], 1, defaultHwDev);
});
