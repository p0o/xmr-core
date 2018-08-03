import {
	MyMoneroApi,
	parseUnspentOutputs,
} from "xmr-mymonero-libs/mymonero-api";
import { Output } from "xmr-types";
import { HWDevice } from "xmr-device/types";
import {
	unspentOutputsResponse,
	randomOutputsReponse,
} from "../fixtures/live-api";
import { JSONPrettyPrint } from "../utils/formatters";
import { LedgerDevice } from "xmr-device";

// type MockApiType = Pick<
// typeof MyMoneroApi,
// "randomOutputs" | "submitSerializedSignedTransaction" | "unspentOutputs"
// >;

export class MockApi {
	public static async unspentOutputs(
		_address: string,
		privViewKey: string,
		pubSpendKey: string,
		privSpendKey: string,
		mixinNumber: number,
		hwdev: HWDevice,
	) {
		JSONPrettyPrint("unspentOutputs_mock", {
			address: _address,
			privViewKey,
			pubSpendKey,
			privSpendKey,
			mixinNumber,
		});

		const {
			address,
			data,
			keyImage_cache,
			spend_key__private,
			spend_key__public,
			view_key__private,
		} = unspentOutputsResponse;
		return parseUnspentOutputs(
			address,
			data,
			hwdev instanceof LedgerDevice ? privViewKey : view_key__private,
			spend_key__public,
			hwdev instanceof LedgerDevice ? privSpendKey : spend_key__private,
			hwdev,
		);
	}

	public static async randomOutputs(usingOuts: Output[], mixin: number) {
		JSONPrettyPrint("randomOutputs_mock", { usingOuts, mixin }, "args");
		return randomOutputsReponse;
	}

	public static async submitSerializedSignedTransaction(
		address: string,
		privViewKey: string,
		serializedSignedTx: string,
	) {
		JSONPrettyPrint(
			"submitSerializedSignedTransaction_mock",
			{
				address,
				privViewKey,
				serializedSignedTx,
			},
			"args",
		);
	}
}
