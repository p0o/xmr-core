import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { LedgerDevice } from "@xmr-core/xmr-crypto-utils";
import { MockApi } from "../../sendfunds/mockApi";
import { JSONPretty } from "@xmr-core/xmr-str-utils";

jest.setTimeout(1000 * 60 * 60);

describe("ledger tests", () => {
	it("should correctly parse unspent outputs", async () => {
		const transport = await TransportNodeHid.create();
		const dev = new LedgerDevice(transport);

		// get "magic" keypair
		const { spendKey, viewKey } = await dev.get_secret_keys();
		const fill: any = "";
		const res = await MockApi.unspentOutputs(
			fill,
			viewKey,
			fill,
			spendKey,
			fill,
			dev,
		);
		2;
		const expected = {
			unspentOuts: [
				{
					amount: "284619610000",
					public_key:
						"d4b94e2516134889b321d6f06792322debb0d311c761c6fc1fc4e699fbb87d31",
					index: 1,
					global_index: 6413358,
					rct:
						"6464fb83555790fac27de59e3fd2cb8d27384ee923ad99de0dfe2e498104b31e67826fabd56cd9596b110c32aff6a41a4eefc4309a43264609f1b69f52331c010db6b4fb75210d33417fc5700eaf5ae67f4f5930b9e4148824deafaf82cb8301",
					tx_id: 4819454,
					tx_hash:
						"4da46a03139ab26295dba21cabcb5f6efc74b165f1df183e83d55169b6902f0b",
					tx_pub_key:
						"c72f9ab780d28ac0c1d5df199c976792d5317fba9873694973b4e66565e54df3",
					tx_prefix_hash:
						"6ffddc62bc7c37b8b2c5dfca7fe2c8be1fc8099d86a4e779946c58dc8f5f2128",
					spend_key_images: [],
					timestamp: "2018-08-01T20:24:27Z",
					height: 1610361,
				},
				{
					amount: "70488860000",
					public_key:
						"0f228ea8ed6223ddb03a655ac47d0c54b6b0294095daa3f9346ca5f75963d8c0",
					index: 0,
					global_index: 6467300,
					rct:
						"09e7d8e6c30ab08baae47db4d590510cf8814e4d3cce2fa6e72bc7b35e56f5f8074dc5bdfce78c017b99b0dbbd3bf2cf40436c142addf29feec70e0e32999b0ad8250bd619b8dd55c93be3bdadd26c3b2cec18772b9b6a5164daaa2dd5fc3700",
					tx_id: 4842002,
					tx_hash:
						"034a94de52657b0b502f28f0c9055959a7eadcfb5ecc6f87b370b3836be38bf0",
					tx_pub_key:
						"dfba079c91578d6af47f1d9ccb37f41b1239e28b739f8ff4d2046f909bbfdc23",
					tx_prefix_hash:
						"b097ad6e54808394774942254d45105b918b1da772221c75f6e906252efd8624",
					spend_key_images: [
						"33b289e7536cde4908ade03d4f9cc98c52d8885745a685efbf283147a4775521",
						"08226ce311285fc07e481eb2ec24852a1e0c78bae9bdd2d279874c4e5d2ad93e",
						"ce3db07bb7bee40cdc74cad4adefe68972c0a3f5e721d3c2ca7981b5243ca598",
					],
					timestamp: "2018-08-01T20:24:27Z",
					height: 1613906,
				},
			],
			unusedOuts: [
				{
					amount: "284619610000",
					public_key:
						"d4b94e2516134889b321d6f06792322debb0d311c761c6fc1fc4e699fbb87d31",
					index: 1,
					global_index: 6413358,
					rct:
						"6464fb83555790fac27de59e3fd2cb8d27384ee923ad99de0dfe2e498104b31e67826fabd56cd9596b110c32aff6a41a4eefc4309a43264609f1b69f52331c010db6b4fb75210d33417fc5700eaf5ae67f4f5930b9e4148824deafaf82cb8301",
					tx_id: 4819454,
					tx_hash:
						"4da46a03139ab26295dba21cabcb5f6efc74b165f1df183e83d55169b6902f0b",
					tx_pub_key:
						"c72f9ab780d28ac0c1d5df199c976792d5317fba9873694973b4e66565e54df3",
					tx_prefix_hash:
						"6ffddc62bc7c37b8b2c5dfca7fe2c8be1fc8099d86a4e779946c58dc8f5f2128",
					spend_key_images: [],
					timestamp: "2018-08-01T20:24:27Z",
					height: 1610361,
				},
				{
					amount: "70488860000",
					public_key:
						"0f228ea8ed6223ddb03a655ac47d0c54b6b0294095daa3f9346ca5f75963d8c0",
					index: 0,
					global_index: 6467300,
					rct:
						"09e7d8e6c30ab08baae47db4d590510cf8814e4d3cce2fa6e72bc7b35e56f5f8074dc5bdfce78c017b99b0dbbd3bf2cf40436c142addf29feec70e0e32999b0ad8250bd619b8dd55c93be3bdadd26c3b2cec18772b9b6a5164daaa2dd5fc3700",
					tx_id: 4842002,
					tx_hash:
						"034a94de52657b0b502f28f0c9055959a7eadcfb5ecc6f87b370b3836be38bf0",
					tx_pub_key:
						"dfba079c91578d6af47f1d9ccb37f41b1239e28b739f8ff4d2046f909bbfdc23",
					tx_prefix_hash:
						"b097ad6e54808394774942254d45105b918b1da772221c75f6e906252efd8624",
					spend_key_images: [
						"33b289e7536cde4908ade03d4f9cc98c52d8885745a685efbf283147a4775521",
						"08226ce311285fc07e481eb2ec24852a1e0c78bae9bdd2d279874c4e5d2ad93e",
						"ce3db07bb7bee40cdc74cad4adefe68972c0a3f5e721d3c2ca7981b5243ca598",
					],
					timestamp: "2018-08-01T20:24:27Z",
					height: 1613906,
				},
			],
			per_kb_fee: "BN:165380000",
		};
		const result = JSON.parse(JSONPretty(res));
		console.log(result);
		expect(result).toMatchObject(expected);
	});
});
