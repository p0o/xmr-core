import { sendFunds } from "xmr-mymonero-libs/mymonero-send-tx";
import { sendFundsArgs } from "../fixtures/live-sendfunds";
import { LedgerDevice } from "xmr-device";
import { MockApi } from "./mockApi";
import { BigInt } from "biginteger";
import { outputsAndAmountToUseForMixinReturn } from "../fixtures/live-outputsAndAmountToUseForMixin";
import { Output } from "xmr-types";
import { MyMoneroApi } from "xmr-mymonero-libs/mymonero-api";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { DeviceMode } from "xmr-device/types";

jest.setTimeout(999999999);
const {
	amount_orZeroWhenSweep,
	isSweep_orZeroWhenAmount,
	mixin,
	nettype,
	payment_id,
	simple_priority,
	target_address,
	wallet__public_address,
	wallet__public_keys,
} = sendFundsArgs;

const mockMixinSelector = (
	_targetAmount: BigInt,
	_unusedOuts: Output[],
	_isRingCt: boolean,
	_sweeping: boolean,
) => {
	const {
		remaining_unusedOuts,
		usingOuts,
		usingOutsAmount,
	} = outputsAndAmountToUseForMixinReturn;

	return {
		remainingUnusedOuts: remaining_unusedOuts,
		usingOuts,
		usingOutsAmount,
	};
};

describe("send funds", () => {
	it("should work", async () => {
		const transport = await TransportNodeHid.create();
		const dev = new LedgerDevice(transport);

		await dev.set_mode(DeviceMode.TRANSACTION_CREATE_REAL);
		// get "magic" keypair
		const { spendKey, viewKey } = await dev.get_secret_keys();

		const res = await sendFunds(
			target_address,
			nettype,
			amount_orZeroWhenSweep,
			isSweep_orZeroWhenAmount,
			wallet__public_address,
			{ spend: spendKey, view: viewKey },
			wallet__public_keys,
			payment_id,
			mixin,
			simple_priority,
			dev,
			(status: number) => console.log(`Status update: ${status}`),
			mockMixinSelector,
			(MockApi as any) as typeof MyMoneroApi,
		);

		console.log(res);
	});
});
