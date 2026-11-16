import { Player, ViewCell } from "@game/shared";
import { World } from "./world.js";
import { isReady, ruleCtx } from "./rules.js";

/** エージェントに見せるマス。中身は observe ルールが決める */
export function View(world: World, player: Player): ViewCell[]{
    if(!isReady(world)){
        return [];
    }
    return world.runtime.observe(ruleCtx(world, world.rngs.observe), player);
}
