import type { GameParams, TransitionMode } from './domain.js';
import { createRng } from './rng.js';
import { GEN_RULES, type ArtifactType, type ArtifactValue } from './rules/generators.js';
import { defaultRuntimeConfig, resolveParamValues, resolveRuntime } from './rules/registry.js';
import type { RuleSelection, RuntimeConfig } from './rules/types.js';

/*
 * ルールファイル：世界の法則と実験の回し方を 1 つにまとめた JSON。
 * constants（複数の場所で使う世界の性質）/ operation（回し方）/ artifacts（生成ルールで作るデータ）/ runtime（フックに差すルール）
 */

export interface RuleConstants {
    nx: number;
    ny: number;
    /** ブロックの種類数 */
    N: number;
    lpInitial: number;
    lpDecreasePerTick: number;
    seed: number;
}

export interface RuleOperation {
    tickIntervalSec: number;
    actionsPerTick: number;
    reconnectTimeoutSec: number;
    transition: TransitionMode;
}

export type Table1D = number[];
export type Table2D = number[][];

export interface ArtifactSpec {
    /** レシピ：生成ルールを上から順に適用する。空なら baked をそのまま使う（手で作った表など） */
    pipeline: RuleSelection[];
    /** パイプラインで使う乱数のシード。実験のシード（constants.seed）とは別なので、実験のシードを変えても表は変わらない */
    seed?: number;
    /** 手修正：パイプラインの結果に上書きする差分。1次元表は "ID"、2次元表は "A,B" をキーにする */
    overrides?: Record<string, number>;
    /** 結果。サーバーはこれを使う */
    baked: Table1D | Table2D;
}

/** レシピ（パイプライン＋シード＋手修正）から結果を作る。おかしなところがあれば例外を投げる */
export function bakeArtifact(spec: Pick<ArtifactSpec, 'pipeline' | 'seed' | 'overrides'>, N: number): ArtifactValue {
    if (spec.pipeline.length === 0) throw new Error('パイプラインが空です');
    const rng = createRng(spec.seed ?? 0);
    let value: ArtifactValue | null = null;
    let type: ArtifactType | null = null;
    spec.pipeline.forEach((step, i) => {
        const def = GEN_RULES[step.rule];
        if (def === undefined) throw new Error(`${i + 1} 番目：${step.rule} という生成ルールはありません`);
        if (def.input !== type) {
            throw new Error(i === 0
                ? `${i + 1} 番目：${def.name} は加工ルールなので先頭には置けません`
                : `${i + 1} 番目：${def.name} は ${def.input ?? '生成'} を受け取るルールですが、前の段は ${type} を出します`);
        }
        const params = resolveParamValues(`${i + 1} 番目の ${def.name}`, def.params, step.params);
        value = def.apply(value, params, { N, rng });
        type = def.output;
    });
    const out = JSON.parse(JSON.stringify(value)) as ArtifactValue;
    for (const [key, v] of Object.entries(spec.overrides ?? {})) {
        if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`overrides の ${key} が数値ではありません`);
        if (type === 'table1d') {
            const id = Number(key);
            if (!Number.isInteger(id) || id < 1 || id > N) throw new Error(`overrides のキー ${key} は 1〜${N} の ID です`);
            (out as number[])[id] = v;
        } else {
            const [a, b] = key.split(',').map(Number);
            if (![a, b].every((x) => Number.isInteger(x) && x >= 1 && x <= N)) throw new Error(`overrides のキー ${key} は "A,B"（1〜${N}）です`);
            (out as number[][])[a][b] = v;
        }
    }
    return out;
}

/** レシピから artifact を作る（結果を焼き込んだもの） */
export function makeArtifact(pipeline: RuleSelection[], seed: number, N: number, overrides?: Record<string, number>): ArtifactSpec {
    const spec: ArtifactSpec = { pipeline, seed, baked: [] };
    if (overrides && Object.keys(overrides).length > 0) spec.overrides = overrides;
    spec.baked = bakeArtifact(spec, N);
    return spec;
}

export interface RuleFile {
    format: 'toyworld-rules';
    version: 1;
    constants: RuleConstants;
    operation: RuleOperation;
    artifacts: Record<string, ArtifactSpec>;
    runtime: RuntimeConfig;
}

/** ライブラリ上の場所 */
export interface RuleRef {
    name: string;
    version: number;
}

/*
 * ブロックIDの範囲。
 * ID 0 は「空」で、ブロックは 1〜N。表は ID をそのまま添字にするので長さ N+1（0 番は使わない）。
 */
export function blockRange(N: number): { min: number; max: number } {
    return { min: 1, max: N + 1 };
}
export function tableSize(N: number): number {
    return N + 1;
}

/** 既定のエネルギー表：エネルギー＝ブロックID */
export function defaultEnergyTable(N: number): Table1D {
    const { min, max } = blockRange(N);
    const t: Table1D = new Array(tableSize(N)).fill(0);
    for (let id = min; id < max; id++) t[id] = id;
    return t;
}

/** 既定の融合表：1〜N の中で A + B を巡回させたもの（A と B が 1 のとき 1、足すほど大きくなり N を超えると 1 に戻る） */
export function defaultFusionTable(N: number): Table2D {
    const size = tableSize(N);
    const t: Table2D = [];
    for (let a = 0; a < size; a++) {
        const row: number[] = [];
        for (let b = 0; b < size; b++) row.push(a === 0 || b === 0 ? 0 : ((a + b - 2) % N) + 1);
        t.push(row);
    }
    return t;
}

/** Admin 画面のフォームで編集できる値（エディタができるまでのつなぎ） */
export interface BasicRuleValues {
    nx: number;
    ny: number;
    N: number;
    lpInitial: number;
    lpDecreasePerTick: number;
    viewRange: number;
    seed: number;
    tickIntervalSec: number;
    actionsPerTick: number;
    reconnectTimeoutSec: number;
    transition: TransitionMode;
}

export function valuesFromParams(p: GameParams): BasicRuleValues {
    return {
        nx: p.map.nx,
        ny: p.map.ny,
        N: p.map.blockMax - p.map.blockMin,
        lpInitial: p.player.lpInitial,
        lpDecreasePerTick: p.player.lpDecreasePerTick,
        viewRange: p.player.viewRange,
        seed: p.seed,
        tickIntervalSec: p.tickIntervalSec,
        actionsPerTick: p.actionsPerTick,
        reconnectTimeoutSec: p.reconnectTimeoutSec,
        transition: p.transition,
    };
}

/** フォームの値から、既定の表・既定のルールを使ったルールファイルを作る */
export function ruleFileFromValues(v: BasicRuleValues): RuleFile {
    const constants: RuleConstants = {
        nx: v.nx, ny: v.ny, N: v.N, lpInitial: v.lpInitial, lpDecreasePerTick: v.lpDecreasePerTick, seed: v.seed,
    };
    const params = paramsFrom(constants, {
        tickIntervalSec: v.tickIntervalSec, actionsPerTick: v.actionsPerTick,
        reconnectTimeoutSec: v.reconnectTimeoutSec, transition: v.transition,
    }, v.viewRange);
    return {
        format: 'toyworld-rules',
        version: 1,
        constants,
        operation: {
            tickIntervalSec: v.tickIntervalSec,
            actionsPerTick: v.actionsPerTick,
            reconnectTimeoutSec: v.reconnectTimeoutSec,
            transition: v.transition,
        },
        artifacts: {
            energyTable: { pipeline: [], baked: defaultEnergyTable(v.N) },
            fusionTable: { pipeline: [], baked: defaultFusionTable(v.N) },
        },
        runtime: defaultRuntimeConfig(params),
    };
}

export function ruleFileFromParams(p: GameParams): RuleFile {
    return ruleFileFromValues(valuesFromParams(p));
}

function paramsFrom(c: RuleConstants, o: RuleOperation, viewRange: number): GameParams {
    const { min, max } = blockRange(c.N);
    return {
        tickIntervalSec: o.tickIntervalSec,
        actionsPerTick: o.actionsPerTick,
        reconnectTimeoutSec: o.reconnectTimeoutSec,
        map: { nx: c.nx, ny: c.ny, blockMin: min, blockMax: max },
        player: { lpInitial: c.lpInitial, lpDecreasePerTick: c.lpDecreasePerTick, viewRange },
        transition: o.transition,
        seed: c.seed,
    };
}

/**
 * ルールファイルから GameParams を作る。
 * エージェントへの joined メッセージや既存のコードは GameParams を見ているので、互換のために残す。
 */
export function gameParamsFromRuleFile(rf: RuleFile): GameParams {
    const obs = rf.runtime.observe;
    const range = typeof obs.params?.range === 'number' ? obs.params.range : 0;
    return paramsFrom(rf.constants, rf.operation, range);
}

export interface RuleFileCheck {
    errors: string[];
    warnings: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isPosInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** ルールファイルの検証。errors が 1 つでもあればライブラリに保存できない・実験に使えない */
export function checkRuleFile(x: unknown): RuleFileCheck {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!isObj(x)) return { errors: ['ルールファイルがオブジェクトではありません'], warnings };
    if (x.format !== 'toyworld-rules') errors.push('format が "toyworld-rules" ではありません');
    if (x.version !== 1) errors.push('version が 1 ではありません');

    const c = x.constants;
    let N = 0;
    if (!isObj(c)) {
        errors.push('constants がありません');
    } else {
        for (const k of ['nx', 'ny', 'N'] as const) if (!isPosInt(c[k])) errors.push(`constants.${k} は 1 以上の整数です`);
        for (const k of ['lpInitial', 'lpDecreasePerTick'] as const) if (!isNum(c[k])) errors.push(`constants.${k} は数値です`);
        if (!(typeof c.seed === 'number' && Number.isInteger(c.seed))) errors.push('constants.seed は整数です');
        if (isPosInt(c.N)) N = c.N;
    }

    const o = x.operation;
    if (!isObj(o)) {
        errors.push('operation がありません');
    } else {
        for (const k of ['tickIntervalSec', 'actionsPerTick', 'reconnectTimeoutSec'] as const) if (!isNum(o[k])) errors.push(`operation.${k} は数値です`);
        if (o.transition !== 'person' && o.transition !== 'agent') errors.push('operation.transition は person か agent です');
    }

    const a = x.artifacts;
    if (!isObj(a)) {
        errors.push('artifacts がありません');
    } else if (N > 0) {
        const size = tableSize(N);
        for (const [name, spec] of Object.entries(a)) {
            if (!isObj(spec) || !Array.isArray(spec.baked)) {
                errors.push(`artifacts.${name}.baked がありません`);
                continue;
            }
            const pipeline = Array.isArray(spec.pipeline) ? spec.pipeline : [];
            if (pipeline.length === 0) {
                if (isObj(spec.overrides) && Object.keys(spec.overrides).length > 0) {
                    warnings.push(`artifacts.${name}：パイプラインが空なので overrides は使われません（baked をそのまま使います）`);
                }
                continue;
            }
            if (!(typeof spec.seed === 'number' && Number.isInteger(spec.seed))) {
                errors.push(`artifacts.${name}.seed は整数です（パイプラインの乱数に使います）`);
                continue;
            }
            try {
                const rebaked = bakeArtifact(spec as unknown as ArtifactSpec, N);
                // 古いルールファイルも読めるように、食い違いはエラーではなく警告にする（サーバーは baked を使う）
                if (JSON.stringify(rebaked) !== JSON.stringify(spec.baked)) {
                    warnings.push(`artifacts.${name}：baked がレシピから作り直した結果と一致しません（手で直すなら overrides に書いてください）`);
                }
            } catch (err) {
                errors.push(`artifacts.${name}：${(err as Error).message}`);
            }
        }
        const e = a.energyTable;
        if (!isObj(e) || !Array.isArray(e.baked)) {
            errors.push('artifacts.energyTable がありません');
        } else if (e.baked.length !== size || !e.baked.every(isNum)) {
            errors.push(`energyTable は長さ ${size} の数値の配列です（N = ${N}）`);
        }
        const f = a.fusionTable;
        if (!isObj(f) || !Array.isArray(f.baked)) {
            errors.push('artifacts.fusionTable がありません');
        } else {
            const rows = f.baked as unknown[];
            const okShape = rows.length === size && rows.every((r) => Array.isArray(r) && r.length === size && r.every(isNum));
            if (!okShape) {
                errors.push(`fusionTable は ${size} × ${size} の数値の表です（N = ${N}）`);
            } else {
                const { min, max } = blockRange(N);
                const bad = (rows as number[][]).some((r, i) => i >= min && i < max && r.some((v, j) => j >= min && j < max && (!Number.isInteger(v) || v < min || v >= max)));
                if (bad) errors.push(`fusionTable の結果は ${min}〜${max - 1} のブロックIDです`);
            }
        }
    }

    const r = x.runtime;
    if (!isObj(r)) {
        errors.push('runtime がありません');
    } else {
        try {
            resolveRuntime(r as unknown as RuntimeConfig);
        } catch (err) {
            errors.push(`runtime: ${(err as Error).message}`);
        }
    }
    return { errors, warnings };
}
