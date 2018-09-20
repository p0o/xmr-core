import { BigInt } from "@xmr-core/biginteger";

export function trimRight(str: string, char: string) {
	while (str[str.length - 1] == char) str = str.slice(0, -1);
	return str;
}

export function padLeft(str: string, len: number, char: string) {
	while (str.length < len) {
		str = char + str;
	}
	return str;
}

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
	if (process.env.NODE_ENV === "test" && process.env.DEBUG) {
		console.log(`[${name}] ${extra || ""}
		${JSON.stringify(obj, pretty, 1)}`);
	}
}
