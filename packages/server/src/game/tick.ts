import { getAllAdmin, getConnection } from "../ws/connection.js";
import { applyAction } from "./action.js";
import { findFreePosition, getWorld } from "./world.js";
import { AdminStateMessage, DEFAULT_GAME_PARAMS, GameParams } from "@game/shared";
import { StateMessage } from "@game/shared";
import { View } from "./view.js";

export function runTick(): void{
    console.log('[Tick]');
    const world = getWorld();
    if(world.params === null){
        return;
    }
    if(world.map === null){
        return;
    }
    
    for (const p of world.players.values()){
        p.lp -= world.params.player.lpDecreasePerTick;
        p.Ltime += 1;
        if(p.Ltime > p.Ltmax){
            p.Ltmax = p.Ltime;
        }
        if(p.lp <= 0){
            //LPの初期化
            p.lp = world.params.player.lpInitial;
            //生存時間の初期化
            p.Ltime = 0;

            //再配置
            const pos = findFreePosition(world.map.nx, world.map.ny, world.players);
            if( pos !== null){
                p.pos.x = pos.x;
                p.pos.y = pos.y;
            }
        }

        

    }

    //アクションの適用
    for (const p of world.players.values()){
        applyAction(p,world);
        p.selectedAction = null;
    }

    //LPをプレイヤーに配信
    for (const p of world.players.values()){
        
        const ws = getConnection(p.uid);
        if(ws === undefined) {
            continue;
        }
        const state: StateMessage = {
            type: 'state',
            you: p,
            view: View(world, p),
            sysmsg: null,
        };

        ws.send(JSON.stringify(state));
    }

    const admins = getAllAdmin();
    if(admins.length > 0){
        const admin_state: AdminStateMessage = {
            type: 'admin_state',
            running: world.running,
            map: {nx: world.map.nx, ny: world.map.ny, data: world.map.data},
            players: Array.from(world.players.values())
        }

        for(const ws of admins) {
            ws.send(JSON.stringify(admin_state));
        }
    }

}