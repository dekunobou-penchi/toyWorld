import { resolveParams, RULES, type GameParams, type HookName, type Rng, type RngSet, type RuleContext, type RuleEvent, type RuntimeHooks } from "@game/shared";
import type { World } from "./world.js";
import { writeEvent } from "./worldlog.js";

/** 初期化が済んでいて、ルールを呼べる状態の World */
export interface ReadyWorld extends World {
    params: GameParams;
    map: NonNullable<World["map"]>;
    rngs: RngSet;
    runtime: RuntimeHooks;
}

export function isReady(world: World): world is ReadyWorld {
    return world.params !== null && world.map !== null && world.rngs !== null && world.runtime !== null;
}

/** フックに渡す ctx を作る。ルールが ctx.log で出したイベントは events.jsonl に記録される */
export function ruleCtx(world: ReadyWorld, rng: Rng): RuleContext {
    return {
        world: { params: world.params, map: world.map, players: world.players },
        rng,
        artifacts: { ...world.artifacts, energyTable: world.energyTable, fusionTable: world.fusionTable },
        log: (event: RuleEvent) => writeEvent(world, event),
    };
}

/** refill か initMap のルールが target として使っている目標分布（無ければ null） */
export function targetDistributionOf(world: World): number[] | null {
    if (world.runtimeConfig === null) return null;
    for (const hook of ["refill", "initMap"] as HookName[]) {
        const sel = world.runtimeConfig[hook];
        const def = RULES[hook][sel.rule];
        if (def === undefined || !("target" in def.params)) continue;
        const name = resolveParams(def, sel.params).target as string;
        const dist = world.artifacts[name];
        if (Array.isArray(dist) && !Array.isArray(dist[0])) return dist as number[];
    }
    return null;
}
