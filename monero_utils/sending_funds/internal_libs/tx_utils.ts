import monero_utils from "monero_utils/monero_cryptonote_utils_instance";
import { getTargetPubViewKey } from "./key_utils";
import { ParsedTarget, JSBigInt, Pid, ViewSendKeys } from "./types";
import { NetType } from "cryptonote_utils/nettype";
import { ERR } from "./errors";
import { Log } from "./logger";
import { popRandElement } from "./arr_utils";
import { calculateFee, multiplyFeePriority } from "./fee_utils";
import { getBaseTotalAmount } from "./amt_utils";

type ConstructTxParams = {
	senderPublicKeys: ViewSendKeys;
	senderPrivateKeys: ViewSendKeys;

	targetAddress: string;
	fundTargets: ParsedTarget[];

	pid: Pid;
	encryptPid: boolean;

	mixOuts?: any;
	mixin: number;
	usingOuts;

	networkFee: JSBigInt;

	isRingCT: boolean;

	nettype: NetType;
};

function makeSignedTx(params: ConstructTxParams) {
	try {
		const {
			senderPublicKeys,
			senderPrivateKeys,

			targetAddress,
			fundTargets,

			pid,
			encryptPid,

			mixOuts,
			mixin,
			usingOuts,

			networkFee,

			isRingCT,

			nettype,
		} = params;

		Log.Target.fullDisplay(fundTargets);

		const targetViewKey = getTargetPubViewKey(
			encryptPid,
			targetAddress,
			nettype,
		);

		const splitDestinations = monero_utils.decompose_tx_destinations(
			fundTargets,
			isRingCT,
		);

		const signedTx = monero_utils.create_transaction(
			senderPublicKeys,
			senderPrivateKeys,
			splitDestinations,
			usingOuts,
			mixOuts,
			mixin,
			networkFee,
			pid,
			encryptPid,
			targetViewKey,
			0,
			isRingCT,
			nettype,
		);

		Log.Transaction.signed(signedTx);

		return { signedTx };
	} catch (e) {
		throw ERR.TX.failure(e);
	}
}

function getSerializedTxAndHash(signedTx) {
	// pre rct
	if (signedTx.version === 1) {
		const serializedSignedTx = monero_utils.serialize_tx(signedTx);
		const txHash = monero_utils.cn_fast_hash(serializedSignedTx);

		const ret = {
			serializedSignedTx,
			txHash,
		};

		Log.Transaction.serializedAndHash(serializedSignedTx, txHash);

		return ret;
	}
	// rct
	else {
		const { raw, hash } = monero_utils.serialize_rct_tx_with_hash(signedTx);

		const ret = {
			serializedSignedTx: raw,
			txHash: hash,
		};

		Log.Transaction.serializedAndHash(raw, hash);

		return ret;
	}
}

function getTxSize(serializedSignedTx, estMinNetworkFee: JSBigInt) {
	// work out per-kb fee for transaction and verify that it's enough
	const txBlobBytes = serializedSignedTx.length / 2;
	let numOfKB = Math.floor(txBlobBytes / 1024);
	if (txBlobBytes % 1024) {
		numOfKB++;
	}

	Log.Fee.txKB(txBlobBytes, numOfKB, estMinNetworkFee);
	return { numOfKB };
}

export function constructTx(params: ConstructTxParams) {
	const { signedTx } = makeSignedTx(params);
	const { serializedSignedTx, txHash } = getSerializedTxAndHash(signedTx);
	const { numOfKB } = getTxSize(serializedSignedTx, params.networkFee);

	return { numOfKB, txHash, serializedSignedTx };
}

type TotalAmtAndEstFeeParams = {
	usingOutsAmount: JSBigInt;
	baseTotalAmount: JSBigInt;

	mixin: number;
	remainingUnusedOuts;
	usingOuts;

	simplePriority: number;
	feelessTotal: JSBigInt;
	feePerKB: JSBigInt; // obtained from server, so passed in
	networkFee: JSBigInt;

	isSweeping: boolean;
	isRingCT: boolean;
};

export function totalAmtAndEstFee(params: TotalAmtAndEstFeeParams) {
	const {
		baseTotalAmount,

		networkFee,

		isRingCT,

		usingOuts,
	} = params;

	if (!isRingCT) {
		return { newFee: networkFee, totalAmount: baseTotalAmount };
	} else {
		/*usingOuts.length > 1 && isRingCT */
		const { newFee, totalAmount } = estRctFeeAndAmt(params);

		Log.Fee.basedOnInputs(newFee, usingOuts);

		return { newFee, totalAmount };
	}
}

type EstRctFeeAndAmtParams = {
	mixin: number;
	usingOutsAmount: JSBigInt;
	remainingUnusedOuts;
	usingOuts;

	simplePriority: number;
	feelessTotal: JSBigInt;
	feePerKB: JSBigInt; // obtained from server, so passed in
	networkFee: JSBigInt;

	isSweeping: boolean;
};

function estRctFeeAndAmt(params: EstRctFeeAndAmtParams) {
	const {
		mixin,

		usingOuts,
		usingOutsAmount,

		simplePriority,

		feePerKB, // obtained from server, so passed in
		networkFee,
		isSweeping,
	} = params;

	let feeBasedOnOuts = calculateFee(
		feePerKB,
		monero_utils.estimateRctSize(usingOuts.length, mixin, 2),
		multiplyFeePriority(simplePriority),
	);

	// if newNeededFee < neededFee, use neededFee instead
	//(should only happen on the 2nd or later times through(due to estimated fee being too low))
	if (feeBasedOnOuts.compare(networkFee) < 0) {
		feeBasedOnOuts = networkFee;
	}

	const [totalAmount, newFee] = isSweeping
		? estRctSwpingAmt(usingOutsAmount, feeBasedOnOuts)
		: estRctNonSwpAmt(params, feeBasedOnOuts);

	return { totalAmount, newFee };
}

function estRctSwpingAmt(usingOutsAmount: JSBigInt, fee: JSBigInt) {
	/* 
	// When/if sending to multiple destinations supported, uncomment and port this:					
	if (dsts.length !== 1) {
		deferred.reject("Sweeping to multiple accounts is not allowed");
		return;
	}
	*/

	// feeless total is equivalent to all outputs (since its a sweeping tx)
	// subtracted from the newNeededFee  (either from min tx cost or calculated cost based on outputs)
	const _feelessTotal = usingOutsAmount.subtract(fee);

	// if the feeless total is less than 0 (so sum of all outputs is still less than network fee)
	// then reject tx
	if (_feelessTotal.compare(0) < 1) {
		throw ERR.BAL.insuff(usingOutsAmount, fee);
	}

	// otherwise make the total amount the feeless total + the new fee
	const totalAmount = _feelessTotal.add(fee);

	return [totalAmount, fee];
}

function estRctNonSwpAmt(params: EstRctFeeAndAmtParams, fee: JSBigInt) {
	const {
		mixin,
		remainingUnusedOuts,
		usingOuts,
		usingOutsAmount,

		simplePriority,
		feelessTotal,
		feePerKB, // obtained from server, so passed in
	} = params;

	// make the current total amount equivalent to the feeless total and the new needed fee
	let currTotalAmount = feelessTotal.add(fee);

	// add outputs 1 at a time till we either have them all or can meet the fee

	// this case can happen when the fee calculated via outs size
	// is greater than the minimum tx fee size,
	// requiring a higher fee, so more outputs (if available)
	// need to be selected to fufill the difference

	let newFee = fee;
	while (
		usingOutsAmount.compare(currTotalAmount) < 0 &&
		remainingUnusedOuts.length > 0
	) {
		const out = popRandElement(remainingUnusedOuts);

		Log.Output.display(out);

		// and recalculate invalidated values
		newFee = calculateFee(
			feePerKB,
			monero_utils.estimateRctSize(usingOuts.length, mixin, 2),
			multiplyFeePriority(simplePriority),
		);
		currTotalAmount = feelessTotal.add(newFee);
	}

	const totalAmount = currTotalAmount;
	return [totalAmount, newFee];
}
