import type { Rng } from '../rng.js';
import type { ParamSpec, ParamValues } from './types.js';

/*
 * 生成ルール：実験の前に 1 回だけ動いて、表などのデータ（artifact）を作る。
 * 生成 → 加工 → 加工 … のパイプラインで使う。表は ID をそのまま添字にするので長さ N+1（0 番は使わない）。
 * 旧 PHP 版（MATLAB の genMeng / genMtbl の移植）と同じ手順にしてある。乱数は ctx.rng だけを使う。
 */

export type ArtifactType = 'table1d' | 'table2d' | 'distribution';
export type ArtifactValue = number[] | number[][];

export interface GenContext {
    /** ブロックの種類数 */
    N: number;
    rng: Rng;
    /** ルールファイルで自分より前にある artifact の結果（前に作ったものを参照してよい） */
    artifacts: Record<string, ArtifactValue>;
}

export interface GenRuleDef {
    name: string;
    /** null なら生成（パイプラインの先頭）、型があれば加工 */
    input: ArtifactType | null;
    output: ArtifactType;
    params: Record<string, ParamSpec>;
    apply(input: ArtifactValue | null, params: ParamValues, ctx: GenContext): ArtifactValue;
}

/** 0〜n-1 から重複なしで k 個選ぶ（選んだ順ではなく元の並び順で返す） */
function sample(n: number, k: number, rng: Rng): number[] {
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rng() * (n - i));
        [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, k).sort((a, b) => a - b);
}

/** lo〜hi の整数を 1 つ */
function randInt(lo: number, hi: number, rng: Rng): number {
    return lo + Math.floor(rng() * (hi - lo + 1));
}

const num = (v: unknown) => v as number;

/** エネルギー：ID が上がるほど指数的に増える（ID 1 で Estart、ID N で Eend） */
export const accelCurve: GenRuleDef = {
    name: 'accelCurve',
    input: null,
    output: 'table1d',
    params: {
        Estart: { type: 'number', default: 1, min: 0.000001 },
        Eend: { type: 'number', default: 100, min: 0.000001 },
    },
    apply: (_input, p, { N }) => {
        const t = new Array(N + 1).fill(0);
        const b = N > 1 ? Math.log(num(p.Eend) / num(p.Estart)) / (N - 1) : 0;
        const a = num(p.Estart) * Math.exp(-b);
        for (let i = 1; i <= N; i++) t[i] = Math.round(a * Math.exp(b * i));
        return t;
    },
};

/** 正のエネルギーを持つ ID のうち、start より大きいものから count 個を選んで符号を反転する */
export const injectNegatives: GenRuleDef = {
    name: 'injectNegatives',
    input: 'table1d',
    output: 'table1d',
    params: {
        count: { type: 'integer', default: 0, min: 0 },
        start: { type: 'integer', default: 0, min: 0 },
    },
    apply: (input, p, { rng }) => {
        const t = [...(input as number[])];
        const cand = t.map((_v, i) => i).filter((i) => i > num(p.start) && t[i] > 0);
        if (cand.length < num(p.count)) {
            throw new Error(`injectNegatives: 候補が ${cand.length} 個しかありません（count = ${num(p.count)}）`);
        }
        for (const k of sample(cand.length, num(p.count), rng)) t[cand[k]] = -t[cand[k]];
        return t;
    },
};

/** 正のエネルギーを持つ ID のうち、start より大きいものから count 個を選んで 0 にする */
export const injectZeros: GenRuleDef = {
    name: 'injectZeros',
    input: 'table1d',
    output: 'table1d',
    params: {
        count: { type: 'integer', default: 0, min: 0 },
        start: { type: 'integer', default: 0, min: 0 },
    },
    apply: (input, p, { rng }) => {
        const t = [...(input as number[])];
        const cand = t.map((_v, i) => i).filter((i) => i > num(p.start) && t[i] > 0);
        if (cand.length < num(p.count)) {
            throw new Error(`injectZeros: 候補が ${cand.length} 個しかありません（count = ${num(p.count)}）`);
        }
        for (const k of sample(cand.length, num(p.count), rng)) t[cand[k]] = 0;
        return t;
    },
};

/**
 * 融合：ブロック i と j（j ≤ i）を融合した結果を決める（下三角だけ埋める）。
 * 各 i について Mnpath 個の j だけが i + Mnup に「ジャンプアップ」し、残りは 1〜i のランダム（同じか格下）。
 * i + Mnup が N を超えるジャンプアップは置かない（旧 PHP 版では N+1 以上のブロックができていた）。
 */
export const jumpUp: GenRuleDef = {
    name: 'jumpUp',
    input: null,
    output: 'table2d',
    params: {
        Mnup: { type: 'integer', default: 1, min: 1 },
        Mnpath: { type: 'integer', default: 1, min: 0 },
    },
    apply: (_input, p, { N, rng }) => {
        const t: number[][] = Array.from({ length: N + 1 }, () => new Array(N + 1).fill(0));
        for (let i = 1; i <= N; i++) {
            const up = i + num(p.Mnup);
            if (up <= N) {
                const k = Math.min(num(p.Mnpath), i);
                for (const s of sample(i, k, rng)) t[i][s + 1] = up;
            }
            for (let j = 1; j <= i; j++) {
                if (t[i][j] === 0) t[i][j] = randInt(1, i, rng);
            }
        }
        return t;
    },
};

/** 下三角を上三角にコピーして、A と B を入れ替えても同じ結果にする */
export const symmetrize: GenRuleDef = {
    name: 'symmetrize',
    input: 'table2d',
    output: 'table2d',
    params: {},
    apply: (input) => {
        const t = (input as number[][]).map((r) => [...r]);
        for (let i = 1; i < t.length; i++) {
            for (let j = i + 1; j < t.length; j++) t[i][j] = t[j][i];
        }
        return t;
    },
};

/*
 * 分布（distribution）：長さ N+1、0 番は 0、1〜N の合計が 1。マップ上で各 ID が占める割合（目標分布）に使う
 */

/** 分布：全部の ID が同じ割合 */
export const uniformDistribution: GenRuleDef = {
    name: 'uniformDistribution',
    input: null,
    output: 'distribution',
    params: {},
    apply: (_input, _p, { N }) => {
        const t = new Array(N + 1).fill(1 / N);
        t[0] = 0;
        return t;
    },
};

/**
 * 分布：エネルギーが高い ID ほど少なくする。重み exp(-lambda × max(エネルギー, 0)) を合計 1 にそろえる。
 * エネルギーが 0 や負の ID は重み 1（一番多い）になる。
 */
export const fromEnergy: GenRuleDef = {
    name: 'fromEnergy',
    input: null,
    output: 'distribution',
    params: {
        source: { type: 'artifact', default: 'energyTable', artifactType: 'table1d' },
        lambda: { type: 'number', default: 0.05, min: 0 },
    },
    apply: (_input, p, { N, artifacts }) => {
        const src = artifacts[p.source as string];
        if (!Array.isArray(src) || src.length !== N + 1 || Array.isArray(src[1])) {
            throw new Error(`fromEnergy: ${String(p.source)} は自分より前にある 1次元表を指定してください`);
        }
        const e = src as number[];
        const w = new Array(N + 1).fill(0);
        for (let i = 1; i <= N; i++) w[i] = Math.exp(-num(p.lambda) * Math.max(e[i], 0));
        const sum = w.reduce((a, b) => a + b, 0);
        return w.map((v) => v / sum);
    },
};

/** 生成ルールの一覧。新しい生成ルールはここに足す */
export const GEN_RULES: Record<string, GenRuleDef> = Object.fromEntries(
    [accelCurve, injectNegatives, injectZeros, jumpUp, symmetrize, uniformDistribution, fromEnergy].map((d) => [d.name, d]),
);
