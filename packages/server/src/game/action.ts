import { GameParams, Player, Position } from "@game/shared";
import {  World } from "./world.js";



export function applyAction(player: Player, world: World): void{
    const map = world.map;
    const params = world.params;
    const rngs = world.rngs;
    if(map === null){
        return;
    }
    if(params === null) {
        return;
    }
    if(world.rngs === null){
        return;
    }

    const blockMax = params.map.blockMax;
    const blockMin = params.map.blockMin;
  

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
                        map.data[pos.y][pos.x] = Math.floor(world.rngs.refill() * (blockMax - blockMin) + blockMin); 
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
                    const energy = world.energyTable[player.hold];
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
                            player.hold = world.fusionTable[player.hold][other_player.hold];
                            other_player.hold = 0;
                        }
                    }

                } else {
                    if(map.data[pos.y][pos.x] !== 0){
                        if(world.fusionTable !== null){
                            player.hold = world.fusionTable[player.hold][map.data[pos.y][pos.x]];
                            map.data[pos.y][pos.x] = Math.floor(world.rngs.refill() * (blockMax - blockMin) + blockMin);
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
    for (const other of world.players.values()){
        if(other.uid === selfuid){
           continue;
        }
        if(other.pos.x === pos.x && other.pos.y === pos.y) {
            return other
        }
    }
    return null;
}