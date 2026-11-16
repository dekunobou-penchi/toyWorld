import { Router } from "express";
import { conversionEnergyTable, conversionFusionTable, getWorld, initWorld, startGame, stopGame } from "../game/world.js";
import { DEFAULT_GAME_PARAMS } from "@game/shared";
import { getConnection } from "../ws/connection.js";
import { createTickTimer } from "../game/ticker.js";
import { GameStateMessage } from "@game/shared";
import { getAllConnections } from "../ws/connection.js";
import { transitionTurn } from "../game/transition.js";
import { StateMessage } from "@game/shared";
import { View } from "../game/view.js";
import { setupWorldLog, writeMeta } from "../game/worldlog.js";
import { broadcastAdminState } from "../game/tick.js";


export function createAdminRouter(): Router {
    const router = Router();
    router.post('/init', (req, res) => {
        const params = req.body.params;
        const experiment = req.body.experimentName;
        if(Object.keys(req.body.params).length !== 0){
            initWorld(params);
            
        } else {
            initWorld(DEFAULT_GAME_PARAMS);
        }

        if(req.body.experimentName.length !== undefined && req.body.experimentName?.length !== 0){
                const world = getWorld();
                world.experimentName = experiment;
        } else {
            const world = getWorld();
            world.experimentName = null;    
        }
   
        //broadcastGameState(false, true);
        broadcastAdminState(getWorld());
        res.json({ ok: true});
        }
    );

    router.post('/start', (_req, res) => {
        const ok = startGame();
        if (!ok) {
            res.status(400).json({ ok: false, error: 'not_initialized'});
            return;
        }
        const world = getWorld();
        if(world.params === null) {
            res.status(500).json({ok: false, error: 'server_error'});
            return;
        }
        //実験名のヌルチェック
        if(world.experimentName === null){
            res.status(400).json({ ok: false, error: 'experimentname_null'});
            return;
        }

        //実験名をworldのパラメーターとして入力
        const path = setupWorldLog(world.experimentName);
        world.logPath = path;
        writeMeta(world);


        if(world.params.transition === "person"){
            createTickTimer(world.params);
        } else if(world.params.transition === "agent"){
            //transitionTurn(world);
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
        }
        broadcastGameState(true, false);
        res.json({ok: true});
    });

    router.post('/stop', (_req, res) => {
        stopGame();
        broadcastGameState(false, false);
        res.json({ok: true});
    })

    router.post('/energy-table', (req, res) => {
        const world = getWorld();
        world.energyTable = conversionEnergyTable(req.body.table);
        res.json({ok: true});
        //console.log(req.body.table);
    })
    
    router.post('/fusion-table', (req, res) => {
        const world = getWorld();

        world.fusionTable = conversionFusionTable(req.body.table);
        res.json({ok: true});
        //console.log(req.body.table);
    })
    return router;
}

function broadcastGameState(running: boolean , reset: boolean): void {
  const msg: GameStateMessage = { type: 'game_state', running , reset};
  const connections = getAllConnections();
  for (const ws of connections) {
    ws.send(JSON.stringify(msg));
  }
}