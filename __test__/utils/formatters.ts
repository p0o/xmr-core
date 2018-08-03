import { BigInt } from "biginteger";

export function pretty(_key: any, value: any) {
	if (value instanceof BigInt) {
		return `BN:${value.toString()}`;
	}
	if (Array.isArray(value)) {
		return value.map(o => (o instanceof BigInt ? `BN:${o.toString()}` : o));
	}
	return value;
}

export function JSONPretty(obj: any) {
	return JSON.stringify(obj, pretty, 1);
}

export function JSONPrettyPrint(name: string, obj: any, extra?: string) {
	console.log(`[${name}] ${extra || ""}
${JSON.stringify(obj, pretty, 1)}`);
}
