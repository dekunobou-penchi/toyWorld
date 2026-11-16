
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { Player, timeStamp } from "@game/shared";
import { join } from 'node:path';
import { getWorld, World } from './world.js';
import { View } from './view.js';
export function setupWorldLog(experimentname: string): string{
    const exp = `exp_${timeStamp()}_${experimentname}`;
    const path = join(process.cwd(), '..', '..','data','experiments', exp);
    mkdirSync(path);

    return path;
}


export function writeMeta(world: World){
   
    const meta = {
        experimentName: world.experimentName,
        rule: world.ruleRef,
        ruleFile: world.ruleFile,
        params: world.params,
        energyTable: world.energyTable,
        fusionTable: world.fusionTable,
        runtime: world.runtimeConfig
    };
    const data = JSON.stringify(meta);
    if(world.logPath !== null){
        const path = join(world.logPath, 'meta.json');
        writeFileSync(path, data);
    }
    

}

export function writePlayerLog(world: World, player: Player){
    const p = {
        //uid: player.uid,
        pos: player.pos,
        dir: player.dir,
        lp: player.lp,
        hold: player.hold,
        action: player.selectedAction,
        view: View(world, player),
    }
  
    let data = JSON.stringify(p);
    data = `${data}\n`;

    if(world.logPath !== null){
        const path = join(world.logPath, `player_${player.uid}.jsonl`);
        appendFileSync(path, data);
    }


}

/** 環境が起こした変化（補充など）を events.jsonl に 1 行ずつ記録する */
export function writeEvent(world: World, event: Record<string, unknown>){
    if(world.logPath === null){
        return;
    }
    appendFileSync(join(world.logPath, 'events.jsonl'), `${JSON.stringify({ tick: world.tick, ...event })}\n`);
}

export function writeWorldLog(world: World){
    if(world.map !== null && world.logPath !== null){
        const w = {
            map: {nx: world.map.nx, ny: world.map.ny, data: world.map.data},
            players: Array.from(world.players.values())
        }
        let data = JSON.stringify(w);
        data = `${data}\n`;
        const path  = join(world.logPath, 'world.jsonl');
        appendFileSync(path, data);
    }
}