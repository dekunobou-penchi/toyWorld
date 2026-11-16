import { GameParams, Player, Position, getPlayerAt as findPlayerAt } from "@game/shared";
import {  World } from "./world.js";
import { isReady, ruleCtx } from "./rules.js";
import { writeEvent } from "./worldlog.js";



export function applyAction(player: Player, world: World): void{
    if(!isReady(world)){
        return;
    }
    const map = world.map;
    const params = world.params;
    const runtime = world.runtime;

    switch (player.selectedAction) {
        case "N":
            player.dir = "N";
            break;
        case "E":
            player.dir = "E";
            break;
        case "S":
            player.dir = "S";
            break;
        case "W":
            player.dir = "W";
            break;
        case "forward": {
            const pos = getFrontPosition(player, params);

   
            let other_player = getPlayerAt(pos, world, player.uid)
            if(other_player === null){
                player.pos.x = pos.x;
                player.pos.y = pos.y;
            } 
            // for(const other of world.players.values()){
            //     if(other.uid === player.uid){
            //         continue;
            //     }
            //     if(other.pos.x === pos.x && other.pos.y === pos.y){
            //         blocked = true;
            //         break;
            //     }
            // }


            break;
        }
        case "get": {
            const pos = getFrontPosition(player, params);
            const other_player = getPlayerAt(pos, world, player.uid);
            const block = map.data[pos.y][pos.x];
            if(other_player === null){
                if(block !== 0){
                    if(player.hold === 0){
                        player.hold = block;
                        // マスを空にしてから補充ルールを呼ぶ
                        map.data[pos.y][pos.x] = 0;
                        map.data[pos.y][pos.x] = runtime.refill(ruleCtx(world, world.rngs.refill), pos, "get");
                        writeEvent(world, { kind: "refill", cause: "get", x: pos.x, y: pos.y, block: map.data[pos.y][pos.x], taken: block, by: player.uid });
                    } else {
                        //const block = map.data[pos.y][pos.x];
                        map.data[pos.y][pos.x] = player.hold;
                        player.hold = block;
                    }
                }   
            } else {

                if(other_player.hold !== 0){
                    if(player.hold === 0){
                        player.hold = other_player.hold;
                        other_player.hold = 0
                    } else {
                        const other_hold = other_player.hold;
                        other_player.hold = player.hold;
                        player.hold = other_hold;
                    }
                    
                } 
            }

            break;
        }
        case "put": {
            const pos = getFrontPosition(player, params);
            const other_player = getPlayerAt(pos, world, player.uid);
            if(player.hold !== 0){
                if(other_player === null){
                        map.data[pos.y][pos.x] = player.hold;
                        player.hold = 0;
                } else {
                    if(other_player.hold !== 0){
                        const other_hold = other_player.hold;
                        other_player.hold = player.hold;
                        player.hold = other_hold;
                    } else {
                        other_player.hold = player.hold;
                        player.hold = 0;
                    }
                }
            }
            break;
        }
        case "eat": {
            if(player.hold !== 0){
                if(world.energyTable !== null){
                    const energy = runtime.energy(ruleCtx(world, world.rngs.energy), player.hold);
                    player.lp += energy;
                    player.hold = 0;
                }
            }
            break;

        }

        case "fusion": {
            const pos = getFrontPosition(player, params);
            const other_player = getPlayerAt(pos, world, player.uid);
            if(player.hold !== 0){
                if(other_player !== null){
                    if(other_player.hold !== 0){
                        if(world.fusionTable !== null){
                            player.hold = runtime.fusion(ruleCtx(world, world.rngs.fusion), player.hold, other_player.hold, "player");
                            other_player.hold = 0;
                        }
                    }

                } else {
                    if(map.data[pos.y][pos.x] !== 0){
                        if(world.fusionTable !== null){
                            const taken = map.data[pos.y][pos.x];
                            player.hold = runtime.fusion(ruleCtx(world, world.rngs.fusion), player.hold, taken, "map");
                            // マスを空にしてから補充ルールを呼ぶ
                            map.data[pos.y][pos.x] = 0;
                            map.data[pos.y][pos.x] = runtime.refill(ruleCtx(world, world.rngs.refill), pos, "fusion");
                            writeEvent(world, { kind: "refill", cause: "fusion", x: pos.x, y: pos.y, block: map.data[pos.y][pos.x], taken, by: player.uid });
                        }
                    }
                }
            }
            break;
        }
        default:
            break;
    }
}

export function getFrontPosition(player: Player, params: GameParams): Position{
    const pos: Position = {x: player.pos.x, y: player.pos.y};
    const map = params.map;


    switch(player.dir) {
        case "N":
            //player.pos.y -= 1;
            pos.y -=1
            break;
        case "E":
            //player.pos.x += 1;
            pos.x += 1;
            break;
        case "S":
            //player.pos.y += 1;
            pos.y += 1;
            break;
        case "W":
            //player.pos.x -= 1;
            pos.x -= 1;
            break;
        default:
            break;
    }
    pos.x = ((pos.x % map.nx) + map.nx) % map.nx;
    pos.y = ((pos.y % map.ny) + map.ny) % map.ny;

    return pos;
}

export function getPlayerAt(pos: Position, world: World, selfuid: string): Player | null{
    // 中身は @game/shared に移した（ルールからも使うため）
    return findPlayerAt(pos, world.players, selfuid) as Player | null;
}
