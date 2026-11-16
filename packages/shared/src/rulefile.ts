import type { GameParams, TransitionMode } from './domain.js';
import { defaultRuntimeConfig, resolveRuntime } from './rules/registry.js';
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
    /** レシピ（Step 4 で使う。今は記録するだけ） */
    pipeline: RuleSelection[];
    /** 手修正（Step 4 で使う。今は記録するだけ） */
    overrides?: Record<string, unknown>;
    /** 結果。サーバーはこれを使う */
    baked: Table1D | Table2D;
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
    return { min: 0, max: N };
}
export function tableSize(N: number): number {
    return N;
}

/** 既定のエネルギー表：エネルギー＝ブロックID */
export function defaultEnergyTable(N: number): Table1D {
    const { min, max } = blockRange(N);
    const t: Table1D = new Array(tableSize(N)).fill(0);
    for (let id = min; id < max; id++) t[id] = id;
    return t;
}

/** 既定の融合表：(A + B) を N で割った余り */
export function defaultFusionTable(N: number): Table2D {
    const size = tableSize(N);
    const t: Table2D = [];
    for (let a = 0; a < size; a++) {
        const row: number[] = [];
        for (let b = 0; b < size; b++) row.push((a + b) % N);
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
            if (Array.isArray(spec.pipeline) && spec.pipeline.length > 0) {
                warnings.push(`artifacts.${name} のパイプラインからの再生成はまだ対応していません（baked をそのまま使います）`);
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
