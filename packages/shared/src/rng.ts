export type Rng = () => number;

export function createRng(seed: number): Rng {
    let b = seed >>> 0;
    return () => {
        b = (b + 0x6D2B79F5) >>> 0;
        let t = b;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export interface RngSet {
    initMap: Rng;
    refill: Rng;
    respawn: Rng;
    spawn: Rng;
    fusion: Rng;
    energy: Rng;
    observe: Rng;
}

export function createRngSet(seed: number): RngSet {
    // seed から親の rng を作り、親から子のシードを順番に取り出して子の rng を作る
    const parent = createRng(seed);
    const child = () => createRng(Math.floor(parent() * 4294967296));
    const initMap = child();
    const refill = child();
    const respawn = child();
    const spawn = child();
    // ↓ Step 2 で追加（fusion・energy・observe のフック用。今のデフォルトルールは使わない）
    const fusion = child();
    const energy = child();
    const observe = child();
    // 新しい乱数を足すときは必ずここ（最後）に足す。間に挟むと後ろの列が全部ずれる
    return { initMap, refill, respawn, spawn, fusion, energy, observe };
}
