import { getAllAdmin, getConnection } from "../ws/connection.js";
import { applyAction } from "./action.js";
import { getWorld } from "./world.js";
import { isReady, ruleCtx, targetDistributionOf } from "./rules.js";
import { AdminStateMessage, DEFAULT_GAME_PARAMS, GameParams } from "@game/shared";
import { StateMessage } from "@game/shared";
import { View } from "./view.js";
import { writePlayerLog, writeWorldLog } from "./worldlog.js";
import { World } from "./world.js";

/** マップ上の今の分布と目標分布のズレ（目標分布を使うルールのときだけ） */
function distributionGap(world: World): AdminStateMessage["distribution"] {
    const target = targetDistributionOf(world);
    if (target === null || world.map === null) return null;
    const N = target.length - 1;
    const counts = new Array(N + 1).fill(0);
    let total = 0;
    for (const row of world.map.data) for (const v of row) { total += 1; if (v >= 1 && v <= N) counts[v] += 1; }
    const current = counts.map((c) => c / total);
    const l1 = target.reduce((acc, p, k) => acc + (k === 0 ? 0 : Math.abs(p - current[k])), 0);
    return { target, current, l1 };
}

export function broadcastAdminState(world: World): void{
    const admins = getAllAdmin();
    if(admins.length > 0 && world.map !== null){
        const admin_state: AdminStateMessage = {
            type: 'admin_state',
            running: world.running,
            map: {nx: world.map.nx, ny: world.map.ny, data: world.map.data},
            players: Array.from(world.players.values()),
            distribution: distributionGap(world),
        }

        for(const ws of admins) {
            ws.send(JSON.stringify(admin_state));
        }
    }
}
export function runTick(): void{
    console.log('[Tick]');
    const world = getWorld();
    if(!isReady(world)){
        return;
    }
    world.tick += 1;
    
    for (const p of world.players.values()){
        p.lp -= world.params.player.lpDecreasePerTick;
        p.Ltime += 1;
        if(p.Ltime > p.Ltmax){
            p.Ltmax = p.Ltime;
        }
        if(p.lp <= 0){
            //生存時間の初期化
            p.Ltime = 0;

            //復活後の状態（LP・hold・向き・位置）は respawn ルールが決める
            const r = world.runtime.respawn(ruleCtx(world, world.rngs.respawn), p);
            p.lp = r.lp;
            p.hold = r.hold;
            p.dir = r.dir;
            if( r.pos !== null){
                p.pos.x = r.pos.x;
                p.pos.y = r.pos.y;
            }
        }

        

    }
    for(const p of world.players.values()){
        writePlayerLog(world, p);
    }
    writeWorldLog(world);

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

    broadcastAdminState(world)

}
