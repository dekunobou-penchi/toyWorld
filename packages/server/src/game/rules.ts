import type { GameParams, Rng, RngSet, RuleContext, RuleEvent, RuntimeHooks } from "@game/shared";
import type { World } from "./world.js";

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

// Step 5 の補充ログで中身を作る。今は何もしない
const noLog = (_event: RuleEvent): void => {};

/** フックに渡す ctx を作る。表は呼ぶたびに World から取るので、途中で差し替えられても反映される */
export function ruleCtx(world: ReadyWorld, rng: Rng): RuleContext {
    return {
        world: { params: world.params, map: world.map, players: world.players },
        rng,
        artifacts: { energyTable: world.energyTable, fusionTable: world.fusionTable },
        log: noLog,
    };
}
