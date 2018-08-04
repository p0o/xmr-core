import {
	NetType,
	ViewSendKeys,
	ParsedTarget,
	Pid,
	Output,
	AmountOutput,
} from "xmr-types";
import { Status } from "../../status_update_constants";
import { BigInt } from "biginteger";
import { MyMoneroApi } from "xmr-mymonero-libs/mymonero-api";
import { HWDevice } from "xmr-device/types";

export type GetFundTargetsAndFeeParams = {
	senderAddress: string;
	senderPublicKeys: ViewSendKeys;
	senderPrivateKeys: ViewSendKeys;

	targetAddress: string;
	targetAmount: number;

	mixin: number;
	unusedOuts: Output[];

	simplePriority: number;
	feelessTotal: BigInt;
	feePerKB: BigInt; // obtained from server, so passed in
	networkFee: BigInt;

	isSweeping: boolean;
	isRingCT: boolean;

	updateStatus: (status: Status) => void;
	api: typeof MyMoneroApi;
	nettype: NetType;
};

export type CreateTxAndAttemptToSendParams = {
	targetAddress: string;
	targetAmount: number;

	senderAddress: string;
	senderPublicKeys: ViewSendKeys;
	senderPrivateKeys: ViewSendKeys;

	fundTargets: ParsedTarget[];

	pid: Pid; // unused
	encryptPid: boolean;

	mixOuts?: AmountOutput[];
	mixin: number;
	usingOuts: Output[];

	simplePriority: number;
	feelessTotal: BigInt;
	feePerKB: BigInt; // obtained from server, so passed in
	networkFee: BigInt;

	isSweeping: boolean;
	isRingCT: boolean;

	updateStatus: (status: Status) => void;
	api: typeof MyMoneroApi;
	nettype: NetType;
	hwdev: HWDevice;
};
