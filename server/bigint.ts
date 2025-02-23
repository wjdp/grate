export function patchBigInt() {
    // @ts-ignore I'm being hacky
    BigInt.prototype.toJSON = function () {
        const int = Number.parseInt(this.toString());
        return int ?? this.toString();
    };
}

export default defineNitroPlugin((nitroApp) => {
    patchBigInt();
})

