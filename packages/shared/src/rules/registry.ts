import type { GameParams } from '../domain.js';
import {
    energyTableLookup,
    forwardLine,
    fusionTableLookup,
    randomMap,
    randomRefill,
    randomRespawn,
} from './defaults.js';
import type { HookName, ParamSpec, ParamValues, RuleDef, RuleSelection, RuntimeConfig, RuntimeHooks } from './types.js';

/** フックごとの使えるルール一覧。新しいルールはここに足す */
export const RULES: { [H in HookName]: Record<string, RuleDef<H>> } = {
    initMap: { [randomMap.name]: randomMap },
    refill: { [randomRefill.name]: randomRefill },
    fusion: { [fusionTableLookup.name]: fusionTableLookup },
    energy: { [energyTableLookup.name]: energyTableLookup },
    respawn: { [randomRespawn.name]: randomRespawn },
    observe: { [forwardLine.name]: forwardLine },
};

export function listRules<H extends HookName>(hook: H): RuleDef<H>[] {
    return Object.values(RULES[hook]);
}

function checkParam(hook: string, rule: string, key: string, spec: ParamSpec, value: unknown): void {
    const where = `${hook}.${rule}.${key}`;
    switch (spec.type) {
        case 'number':
        case 'integer':
            if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`${where} は数値が必要です`);
            if (spec.type === 'integer' && !Number.isInteger(value)) throw new Error(`${where} は整数が必要です`);
            if (spec.min !== undefined && value < spec.min) throw new Error(`${where} は ${spec.min} 以上です`);
            if (spec.max !== undefined && value > spec.max) throw new Error(`${where} は ${spec.max} 以下です`);
            break;
        case 'boolean':
            if (typeof value !== 'boolean') throw new Error(`${where} は true / false が必要です`);
            break;
        case 'enum':
            if (typeof value !== 'string' || !spec.options.includes(value)) throw new Error(`${where} は ${spec.options.join(' / ')} のどれかです`);
            break;
        case 'artifact':
            if (typeof value !== 'string') throw new Error(`${where} は artifact の名前が必要です`);
            break;
    }
}

/** 宣言されたパラメータに既定値を補い、型と範囲を確かめる */
export function resolveParams(def: RuleDef, given: ParamValues = {}): ParamValues {
    for (const key of Object.keys(given)) {
        if (!(key in def.params)) throw new Error(`${def.hook}.${def.name} に ${key} というパラメータはありません`);
    }
    const out: ParamValues = {};
    for (const [key, spec] of Object.entries(def.params)) {
        const value = key in given ? given[key] : spec.default;
        checkParam(def.hook, def.name, key, spec, value);
        out[key] = value;
    }
    return out;
}

function build<H extends HookName>(hook: H, sel: RuleSelection): RuntimeHooks[H] {
    const def = RULES[hook][sel.rule];
    if (def === undefined) {
        throw new Error(`${hook} に ${sel.rule} というルールはありません`);
    }
    return def.create(resolveParams(def, sel.params));
}

/** runtime の設定から、実際にフックに差す関数の組を作る */
export function resolveRuntime(config: RuntimeConfig): RuntimeHooks {
    return {
        initMap: build('initMap', config.initMap),
        refill: build('refill', config.refill),
        fusion: build('fusion', config.fusion),
        energy: build('energy', config.energy),
        respawn: build('respawn', config.respawn),
        observe: build('observe', config.observe),
    };
}

/**
 * Step 1 時点のサーバーと同じ挙動になる runtime 設定。
 * ルールファイル（Step 3）ができるまでは、これを GameParams から作って使う。
 */
export function defaultRuntimeConfig(params: GameParams): RuntimeConfig {
    return {
        initMap: { rule: 'randomMap' },
        refill: { rule: 'randomRefill' },
        fusion: { rule: 'tableLookup', params: { table: 'fusionTable' } },
        energy: { rule: 'tableLookup', params: { table: 'energyTable' } },
        respawn: { rule: 'randomRespawn', params: { resetHold: true, randomDir: false } },
        observe: { rule: 'forwardLine', params: { range: params.player.viewRange } },
    };
}
