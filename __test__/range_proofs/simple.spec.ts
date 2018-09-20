import { ctskpkGen, populateFromBlockchainSimple } from "./test_utils";

import { BigInt } from "@xmr-core/biginteger";

import { hash_to_scalar } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/hash_ops";

import { Z } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/constants";

import {
	random_keypair,
	random_scalar,
	DefaultDevice,
} from "@xmr-core/xmr-crypto-utils";

import { generate_key_image } from "@xmr-core/xmr-crypto-utils/lib/crypto-ops/key_image";

import {
	genRct,
	verRctSimple,
	decodeRctSimple,
} from "@xmr-core/xmr-transaction";

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

it("should test ringct simple transactions", async () => {
	//Ring CT Stuff
	//ct range proofs
	// ctkey vectors
	let inSk = [],
		inPk = [],
		outamounts = [], // output amounts
		inamounts = [], // input amounts
		amount_keys = [],
		destinations = [];
	//add fake input 3000
	//inSk is secret data
	//inPk is public data
	{
		let [sctmp, pctmp] = ctskpkGen(3000);
		inSk.push(sctmp);
		inPk.push(pctmp);
		inamounts.push(new BigInt(3000));
	}

	//add fake input 3000
	//inSk is secret data
	//inPk is public data
	{
		let [sctmp, pctmp] = ctskpkGen(3000);
		inSk.push(sctmp);
		inPk.push(pctmp);
		inamounts.push(new BigInt(3000));
	}

	outamounts.push(new BigInt(5000));
	amount_keys.push(hash_to_scalar(Z));
	destinations.push(random_keypair().pub);

	outamounts.push(new BigInt(999));
	amount_keys.push(hash_to_scalar(Z));
	destinations.push(random_keypair().pub);

	const message = random_scalar();
	const txnFee = "1";

	// generate mixin and indices
	let mixRings = [];
	let indices = [];
	const mixin = 3;
	for (let i = 0; i < inPk.length; i++) {
		const { mixRing, index } = populateFromBlockchainSimple(inPk[i], mixin);
		mixRings.push(mixRing);
		indices.push(index);
	}

	// generate kimg
	const kimg = [
		generate_key_image(inPk[0].dest, inSk[0].x),
		generate_key_image(inPk[1].dest, inSk[1].x),
	];

	const defaultHwDev = new DefaultDevice();

	const s = await genRct(
		message,
		inSk,
		kimg,
		destinations,
		inamounts,
		outamounts,
		mixRings,
		amount_keys,
		indices,
		txnFee,
		defaultHwDev,
	);

	expect(await verRctSimple(s, true, mixRings, kimg)).toEqual(true);
	expect(await verRctSimple(s, false, mixRings, kimg)).toEqual(true);

	await decodeRctSimple(s, amount_keys[1], 1, defaultHwDev);
});
