import { Router } from "express";
import { conversionEnergyTable, conversionFusionTable, getWorld, initWorld, startGame, stopGame } from "../game/world.js";
import { DEFAULT_GAME_PARAMS } from "@game/shared";

import { createTickTimer } from "../game/ticker.js";
import { GameStateMessage } from "@game/shared";
import { getAllConnections } from "../ws/connection.js";
export function createAdminRouter(): Router {
    const router = Router();
    router.post('/init', (req, res) => {
        const params = req.body;
        if(Object.keys(req.body).length !== 0){
            initWorld(params);
        } else {
            initWorld(DEFAULT_GAME_PARAMS);
        }
   
        broadcastGameState(false, true);
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
        createTickTimer(world.params);
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