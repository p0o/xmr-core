import { ViewSendKeys, JSBigInt } from "./types";
import { Log } from "./logger";
import { ERR } from "./errors";

export class WrappedNodeApi {
	private api: any;
	constructor(api: any) {
		this.api = api;
	}

	public unspentOuts(
		address: string,
		privateKeys: ViewSendKeys,
		publicKeys: ViewSendKeys,
		mixin: number,
		isSweeping: boolean,
	) {
		type ResolveVal = {
			unspentOuts;
			unusedOuts;
			dynamicFeePerKB: JSBigInt;
		};

		return new Promise<ResolveVal>((resolve, reject) => {
			const { spend: xSpend, view: xView } = privateKeys;
			const { spend: pubSend } = publicKeys;
			const handler = (
				err: Error,
				unspentOuts,
				unusedOuts,
				dynamicFeePerKB: JSBigInt,
			) => {
				if (err) {
					return reject(err);
				}

				Log.Fee.dynPerKB(dynamicFeePerKB);
				return resolve({
					unspentOuts,
					unusedOuts,
					dynamicFeePerKB,
				});
			};

			this.api.UnspentOuts(
				address,
				xView,
				pubSend,
				xSpend,
				mixin,
				isSweeping,
				handler,
			);
		});
	}

	public randomOuts(usingOuts, mixin: number) {
		return new Promise<{ amount_outs }>((resolve, reject) => {
			this.api.RandomOuts(
				usingOuts,
				mixin,
				(err: Error, amount_outs) =>
					err ? reject(err) : resolve({ amount_outs }),
			);
		});
	}

	public submitSerializedSignedTransaction(
		address: string,
		privateKeys: ViewSendKeys,
		serializedSignedTx,
	) {
		return new Promise<void>((resolve, reject) => {
			this.api.SubmitSerializedSignedTransaction(
				address,
				privateKeys.view,
				serializedSignedTx,
				(err: Error) =>
					err ? reject(ERR.TX.submitUnknown(err)) : resolve(),
			);
		});
	}
}
