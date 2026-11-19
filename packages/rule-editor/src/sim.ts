import {
    createRng,
    createRngSet,
    gameParamsFromRuleFile,
    resolveRuntime,
    type Artifacts,
    type Direction,
    type Player,
    type RuleContext,
    type RuleFile,
    type RuntimeHooks,
} from "@game/shared";
import { targetNameOf } from "./model";

/*
 * プレビュー用：サーバーと同じルールのコードをブラウザで動かす。
 * 乱数もサーバーと同じ createRngSet(constants.seed) を使うので、初期マップなどは実際の実験と同じになる。
 */

export function artifactsOf(rule: RuleFile): Artifacts {
    const a = Object.fromEntries(Object.entries(rule.artifacts).map(([k, v]) => [k, v.baked])) as Record<string, number[] | number[][]>;
    return { ...a, energyTable: (a.energyTable as number[]) ?? null, fusionTable: (a.fusionTable as number[][]) ?? null };
}

export function runtimeOf(rule: RuleFile): RuntimeHooks | null {
    try {
        return resolveRuntime(rule.runtime);
    } catch {
        return null;
    }
}

export function fakePlayer(x: number, y: number, dir: Direction, hold = 0, uid = "preview"): Player {
    return {
        uid,
        profile: { name: uid, age: 0, gender: "na", isAgent: true },
        pos: { x, y },
        dir,
        lp: 100,
        hold,
        Ltime: 0,
        Ltmax: 0,
        selectedAction: null,
    };
}

export function ctxOf(rule: RuleFile, map: number[][], rng: () => number, players: Player[] = []): RuleContext {
    const params = gameParamsFromRuleFile(rule);
    return {
        world: { params, map: { nx: rule.constants.nx, ny: rule.constants.ny, data: map }, players: new Map(players.map((p) => [p.uid, p])) },
        rng,
        artifacts: artifactsOf(rule),
        log: () => {},
    };
}

/** このルールで作られる初期マップ（実験のシードで） */
export function initialMap(rule: RuleFile): number[][] {
    const rt = runtimeOf(rule);
    if (rt === null) throw new Error("runtime にエラーがあります");
    return rt.initMap({
        params: gameParamsFromRuleFile(rule),
        rng: createRngSet(rule.constants.seed).initMap,
        artifacts: artifactsOf(rule),
        log: () => {},
    });
}

export interface RefillSimOptions {
    taker: "greedy" | "random";
    ticks: number;
    /** 1 tick に取る回数の期待値（0〜1） */
    rate: number;
    /** 個数のヒストグラムに入れない最初の tick 数 */
    burnIn: number;
}

export interface RefillSimResult {
    /** マップのマス数（2項分布の試行回数 M） */
    cells: number;
    target: number[] | null;
    /** シミュレーション最後のマップ上の割合（index 0 は使わない） */
    final: number[];
    /** tick ごとの目標とのズレ（L1）。目標分布がなければ空 */
    l1Series: number[];
    l1: number | null;
    /** 目標どおりの確率で M マスにばらまいたとき、L1 の 95% がこれ以下になる値（モンテカルロで求める） */
    l1Chance: number | null;
    /** 2項分布の ±2σ（約95%）から外れた ID */
    outside: number[];
    /** 目標どおりにばらまいても ±2σ から外れる ID の数の期待値（2項分布から正確に計算） */
    outsideExpected: number | null;
    /** hist[id][c] = そのIDが c 個だった tick の数（burnIn より後だけ数える） */
    hist: number[][];
    /** ヒストグラムに入れた tick 数 */
    samples: number;
    sameRate: number;
    refills: number;
}

function proportions(map: number[][], N: number): number[] {
    const c = new Array(N + 1).fill(0);
    let total = 0;
    for (const row of map) for (const v of row) { total++; if (v >= 1 && v <= N) c[v]++; }
    return c.map((x) => x / total);
}

/** 割合 p の ID が M マス中に占める割合の標準偏差（2項分布 B(M, p) を M で割ったもの） */
export function binomialSd(p: number, M: number): number {
    return Math.sqrt((p * (1 - p)) / M);
}

/** 2項分布 B(M, p) の確率 P(X = c)（c = 0..M）。大きな M でも溢れないように対数で計算する */
export function binomialPmf(M: number, p: number): number[] {
    if (p <= 0) return Array.from({ length: M + 1 }, (_, c) => (c === 0 ? 1 : 0));
    if (p >= 1) return Array.from({ length: M + 1 }, (_, c) => (c === M ? 1 : 0));
    const lf = [0];
    for (let i = 1; i <= M; i++) lf.push(lf[i - 1] + Math.log(i));
    const lp = Math.log(p), lq = Math.log(1 - p);
    return Array.from({ length: M + 1 }, (_, c) => Math.exp(lf[M] - lf[c] - lf[M - c] + c * lp + (M - c) * lq));
}

/** 目標どおりの確率で M マスにばらまく（多項分布）のを trials 回やって、L1 の q 分位点を返す */
export function chanceL1(target: number[], M: number, seed: number, trials = 300, q = 0.95): number {
    const rng = createRng(seed);
    const N = target.length - 1;
    const cum: number[] = [];
    let acc = 0;
    for (let k = 1; k <= N; k++) { acc += target[k]; cum.push(acc); }
    const l1s: number[] = [];
    const c = new Array(N + 1);
    for (let t = 0; t < trials; t++) {
        c.fill(0);
        for (let i = 0; i < M; i++) {
            const r = rng() * acc;
            let lo = 0, hi = N - 1;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] > r) hi = mid; else lo = mid + 1; }
            c[lo + 1]++;
        }
        let l1 = 0;
        for (let k = 1; k <= N; k++) l1 += Math.abs(c[k] / M - target[k]);
        l1s.push(l1);
    }
    l1s.sort((a, b) => a - b);
    return l1s[Math.min(trials - 1, Math.floor(q * trials))];
}

/** 目標どおりにばらまいたとき、±2σ から外れる ID の数の期待値 */
function expectedOutside(target: number[], M: number): number {
    let sum = 0;
    for (let k = 1; k < target.length; k++) {
        const p = target[k];
        if (p <= 0 || p >= 1) continue;
        const sd = binomialSd(p, M);
        sum += binomialPmf(M, p).reduce((a, v, c) => a + (Math.abs(c / M - p) > 2 * sd ? v : 0), 0);
    }
    return sum;
}

function l1Of(target: number[], p: number[]): number {
    return target.reduce((a, v, k) => a + (k === 0 ? 0 : Math.abs(v - (p[k] ?? 0))), 0);
}

/**
 * 補充シミュレーション：仮のエージェントがブロックを取り、refill ルールで補充する。
 * greedy はランダムな 5 マスを見て一番エネルギーが高いものを、random はランダムな 1 マスを取る。
 */
export function simulateRefill(rule: RuleFile, opt: RefillSimOptions): RefillSimResult {
    const rt = runtimeOf(rule);
    if (rt === null) throw new Error("runtime にエラーがあります");
    const N = rule.constants.N;
    const { nx, ny } = rule.constants;
    const map = initialMap(rule);
    const energy = (rule.artifacts.energyTable?.baked as number[]) ?? [];
    const refillRng = createRngSet(rule.constants.seed).refill;
    const agentRng = createRng(rule.constants.seed ^ 0x5bd1e995);
    const ctx = ctxOf(rule, map, refillRng);
    const tName = targetNameOf(rule);
    const target = tName !== null && Array.isArray(rule.artifacts[tName]?.baked) ? (rule.artifacts[tName].baked as number[]) : null;

    const M = nx * ny;
    const l1Series: number[] = [];
    let same = 0;
    let refills = 0;
    // ID ごとの今の個数（1 マス変わるたびに更新する）
    const count = new Array(N + 1).fill(0);
    for (const row of map) for (const v of row) if (v >= 1 && v <= N) count[v]++;
    const hist = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(0) as number[]);
    let samples = 0;
    const record = (t: number) => {
        if (target !== null) l1Series.push(l1Of(target, proportions(map, N)));
        if (t >= opt.burnIn) {
            for (let k = 1; k <= N; k++) hist[k][count[k]]++;
            samples++;
        }
    };
    record(0);
    for (let t = 0; t < opt.ticks; t++) {
        if (agentRng() < opt.rate) {
            let best = { x: 0, y: 0, e: -Infinity };
            const looks = opt.taker === "greedy" ? 5 : 1;
            for (let k = 0; k < looks; k++) {
                const x = Math.floor(agentRng() * nx);
                const y = Math.floor(agentRng() * ny);
                const e = energy[map[y][x]] ?? 0;
                if (e > best.e) best = { x, y, e };
            }
            const taken = map[best.y][best.x];
            if (taken !== 0) {
                map[best.y][best.x] = 0;
                const b = rt.refill(ctx, { x: best.x, y: best.y }, "get");
                map[best.y][best.x] = b;
                if (taken >= 1 && taken <= N) count[taken]--;
                if (b >= 1 && b <= N) count[b]++;
                refills++;
                if (b === taken) same++;
            }
        }
        record(t + 1);
    }
    const final = proportions(map, N);
    let l1: number | null = null, l1Chance: number | null = null, outsideExpected: number | null = null;
    const outside: number[] = [];
    if (target !== null) {
        l1 = l1Of(target, final);
        l1Chance = chanceL1(target, M, rule.constants.seed ^ 0x2545f491);
        outsideExpected = expectedOutside(target, M);
        for (let k = 1; k <= N; k++) {
            if (Math.abs(final[k] - target[k]) > 2 * binomialSd(target[k], M)) outside.push(k);
        }
    }
    return { cells: M, target, final, l1Series, l1, l1Chance, outside, outsideExpected, hist, samples, sameRate: refills === 0 ? 0 : same / refills, refills };
}
