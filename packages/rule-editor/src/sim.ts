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
    /** 推移を記録する ID */
    watch: number[];
}

export interface RefillSimResult {
    /** watch の ID ごとの、tick ごとのマップ上の割合 */
    series: number[][];
    target: number[] | null;
    l1: number | null;
    sameRate: number;
    refills: number;
}

function proportions(map: number[][], N: number): number[] {
    const c = new Array(N + 1).fill(0);
    let total = 0;
    for (const row of map) for (const v of row) { total++; if (v >= 1 && v <= N) c[v]++; }
    return c.map((x) => x / total);
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

    const series = opt.watch.map(() => [] as number[]);
    let same = 0;
    let refills = 0;
    const record = () => {
        const p = proportions(map, N);
        opt.watch.forEach((id, i) => series[i].push(p[id] ?? 0));
    };
    record();
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
                refills++;
                if (b === taken) same++;
            }
        }
        record();
    }
    const p = proportions(map, N);
    const l1 = target === null ? null : target.reduce((a, v, k) => a + (k === 0 ? 0 : Math.abs(v - p[k])), 0);
    return { series, target, l1, sameRate: refills === 0 ? 0 : same / refills, refills };
}
