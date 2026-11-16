
export type Rng = () => number;

export function createRng(seed: number): () => number {
    let b = seed >>> 0;
    return () => {
        b = (b + 0x6D2B79F5) >>> 0;
        let t = b;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function createRngSet(seed: number) {
    // seed から親の rng を作る
    const a = createRng(seed);
    const initMap = createRng(Math.floor(a()*4294967296));
    const refill = createRng(Math.floor(a()*4294967296));
    const respawn = createRng(Math.floor(a()*4294967296));
    const spawn   = createRng(Math.floor(a() * 4294967296));
    // 親から子のシードを順番に取り出して、子の rng を3つ作る
    return { initMap: initMap, refill: refill, respawn: respawn, spawn: spawn};
}

export interface RngSet {
    initMap: Rng;
    refill: Rng;
    respawn: Rng;
    spawn: Rng;
}


