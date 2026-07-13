import { Player, ViewCell, Direction, VisiblePlayer } from "@game/shared";
import { World } from "./world.js";
import { getPlayerAt } from "./action.js";

export function View(world: World, player: Player): ViewCell[]{

    const map = world.map;
    const params = world.params;
    const vec = DIR_TO_VEC[player.dir];
    const dx = vec.dx;
    const dy = vec.dy;

    if(params === null){
        return [];
    }
    if(map === null){
        return [];
    }
    const cells: ViewCell[] = [];

    for(let i = 1; i <= params.player.viewRange; i++) {
        const x = (((player.pos.x + (dx * i)) % map.nx) + map.nx) % map.nx;
        const y = (((player.pos.y + (dy * i)) % map.ny) + map.ny) % map.ny;

        //他プレイヤーの情報集め
        const other_player = getPlayerAt({x: x, y: y}, world, player.uid);
        if(other_player !== null){
            const visible: VisiblePlayer = {name: other_player.profile.name, dir: other_player.dir, lp: other_player.lp, hold: other_player.hold};
            const viewcell: ViewCell = {x: x, y: y, block: map.data[y][x], player: visible};
            cells.push(viewcell);
            break;
        } else {
            const viewcell: ViewCell = {x: x, y: y, block: map.data[y][x], player: null};
            cells.push(viewcell);
        }
    }
    return cells



}

const DIR_TO_VEC: Record<Direction, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
};