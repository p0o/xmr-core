import { sendFunds } from "xmr-mymonero-libs/mymonero-send-tx";
import { sendFundsArgs } from "../fixtures/live-sendfunds";
import { DefaultDevice } from "xmr-device";
import { MockApi } from "./mockApi";
import { BigInt } from "biginteger";
import { outputsAndAmountToUseForMixinReturn } from "../fixtures/live-outputsAndAmountToUseForMixin";
import { Output } from "xmr-types";
import { MyMoneroApi } from "xmr-mymonero-libs/mymonero-api";
const {
	amount_orZeroWhenSweep,
	isSweep_orZeroWhenAmount,
	mixin,
	nettype,
	payment_id,
	simple_priority,
	target_address,
	wallet__private_keys,
	wallet__public_address,
	wallet__public_keys,
} = sendFundsArgs;
const dev = new DefaultDevice();

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
		const res = await sendFunds(
			target_address,
			nettype,
			amount_orZeroWhenSweep,
			isSweep_orZeroWhenAmount,
			wallet__public_address,
			wallet__private_keys,
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
