import { makeRequest, withUserAgentParams } from "./request-utils";
import { myMoneroConfig } from "../mymonero-config";
import { config } from "@xmr-core/xmr-constants";
import {
	parseAddressInfo,
	parseAddressTransactions,
	parseUnspentOutputs,
} from "./response-parsers";
import { BigInt } from "@xmr-core/biginteger";
import { HWDevice, isRealDevice } from "@xmr-core/xmr-crypto-utils";
import { JSONPrettyPrint } from "@xmr-core/xmr-str-utils";
import { Output } from "@xmr-core/xmr-transaction";
import { ERR } from "@xmr-core/xmr-mymonero-libs/src/mymonero-send-tx/internal_libs/errors";

export class MyMoneroApi {
	public static async login(address: string, privViewKey: string) {
		const parameters = {
			address,
			view_key: privViewKey,
			create_account: true,
		};

		const data = await makeRequest(
			myMoneroConfig.hostName,
			"login",
			parameters,
		);

		return data.new_address;
	}

	public static async addressInfo(
		address: string,
		privViewKey: string,
		pubSpendKey: string,
		privSpendKey: string,
		hwdev: HWDevice,
	) {
		const parameters = {
			address,
			view_key: privViewKey,
		};

		const data = await makeRequest(
			myMoneroConfig.hostName,
			"get_address_info",
			parameters,
		);

		return parseAddressInfo(
			address,
			data,
			isRealDevice(hwdev)
				? (await hwdev.get_secret_keys()).viewKey
				: privViewKey,
			pubSpendKey,
			privSpendKey,
			hwdev,
		);
	}
	public static async addressTransactions(
		address: string,
		privViewKey: string,
		pubSpendKey: string,
		privSpendKey: string,
		hwdev: HWDevice,
	) {
		const parameters = {
			address,
			view_key: privViewKey,
		};

		const data = await makeRequest(
			myMoneroConfig.hostName,
			"get_address_txs",
			parameters,
		);

		return parseAddressTransactions(
			address,
			data,
			isRealDevice(hwdev)
				? (await hwdev.get_secret_keys()).viewKey
				: privViewKey,
			pubSpendKey,
			privSpendKey,
			hwdev,
		);
	}

	// Getting wallet txs import info
	public static async importRequestInfoAndStatus(
		address: string,
		privViewKey: string,
	) {
		const parameters = withUserAgentParams({
			address,
			view_key: privViewKey,
		});

		const data = await makeRequest(
			myMoneroConfig.hostName,
			"import_wallet_request",
			parameters,
		);

		return {
			payment_id: data.payment_id,
			payment_address: data.payment_address,
			import_fee: new BigInt(data.import_fee),
			feeReceiptStatus: data.feeReceiptStatus,
		};
	}

	// Getting outputs for sending funds
	public static async unspentOutputs(
		address: string,
		privViewKey: string,
		pubSpendKey: string,
		privSpendKey: string,
		mixinNumber: number,
		hwdev: HWDevice,
	) {
		JSONPrettyPrint(
			"unspentOutputs",
			{
				address,
				privViewKey,
				pubSpendKey,
				privSpendKey,
				mixinNumber,
			},
			"args",
		);
		const parameters = withUserAgentParams({
			address,
			view_key: privViewKey,
			amount: "0",
			mixin: mixinNumber,
			use_dust: true, // Client now filters unmixable by dustthreshold amount (unless sweeping) + non-rc
			dust_threshold: config.dustThreshold.toString(),
		});

		const data = await makeRequest(
			myMoneroConfig.hostName,
			"get_unspent_outs",
			parameters,
		);

		JSONPrettyPrint(
			"unspentOutputs",
			{
				parameters,
				data,
			},
			"pre_parseUnspentOutputs_dataAndParams",
		);

		return parseUnspentOutputs(
			address,
			data,
			isRealDevice(hwdev)
				? (await hwdev.get_secret_keys()).viewKey
				: privViewKey,
			pubSpendKey,
			privSpendKey,
			hwdev,
		);
	}

	public static async randomOutputs(usingOuts: Output[], mixin: number) {
		JSONPrettyPrint("randomOutputs", { usingOuts, mixin }, "args");

		if (mixin < 0 || isNaN(mixin)) {
			throw Error("Invalid mixin - must be >= 0");
		}

		const amounts = usingOuts.map(o => (o.rct ? "0" : o.amount.toString()));

		const parameters = withUserAgentParams({
			amounts,
			count: mixin + 1, // Add one to mixin so we can skip real output key if necessary
		});

		const data = await makeRequest(
			myMoneroConfig.hostName,
			"get_random_outs",
			parameters,
		);

		JSONPrettyPrint(
			"randomOutputs",
			{ amount_outs: data.amount_outs },
			"ret",
		);

		return { amount_outs: data.amount_outs };
	}

	public static async submitSerializedSignedTransaction(
		address: string,
		privViewKey: string,
		serializedSignedTx: string,
	) {
		const parameters = withUserAgentParams({
			address,
			view_key: privViewKey,
			tx: serializedSignedTx,
		});
		try {
			return await makeRequest(
				myMoneroConfig.hostName,
				"submit_raw_tx",
				parameters,
			);
		} catch (e) {
			console.error(e);
			throw ERR.TX.submitUnknown(e);
		}
	}
}
