import { Router } from "express";
import { getWorld, initWorld, startGame, stopGame } from "../game/world.js";
import { checkRuleFile, DEFAULT_GAME_PARAMS, ruleFileFromParams, type GameParams, type RuleFile, type RuleRef } from "@game/shared";
import { basename } from "node:path";
import { getRule, LibraryError, lockRule } from "../rules/library.js";
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
    /*
     * 初期化。どのルールを使うかは次のどれかで指定する（上ほど優先）
     *   rule:     { name, version }  … ライブラリのルールファイル（実験を開始するとロックされる）
     *   ruleFile: RuleFile           … ルールファイルを直接渡す
     *   params:   GameParams         … 旧形式。既定の表・既定のルールのルールファイルに変換して使う
     * seed を渡すとルールファイルのシードを上書きする
     */
    router.post('/init', (req, res) => {
        const body = (req.body ?? {}) as { rule?: RuleRef; ruleFile?: unknown; params?: GameParams; seed?: unknown; experimentName?: unknown };
        let rule: unknown;
        let ref: RuleRef | null = null;
        try {
            if (body.rule !== undefined) {
                ref = { name: String(body.rule.name), version: Number(body.rule.version) };
                rule = getRule(ref).rule;
            } else if (body.ruleFile !== undefined) {
                rule = body.ruleFile;
            } else if (body.params !== undefined && Object.keys(body.params).length !== 0) {
                rule = ruleFileFromParams({ ...DEFAULT_GAME_PARAMS, ...body.params });
            } else {
                rule = ruleFileFromParams(DEFAULT_GAME_PARAMS);
            }
        } catch (err) {
            if (err instanceof LibraryError) {
                res.status(err.code === "not_found" ? 404 : 400).json({ ok: false, error: err.code, message: err.message });
                return;
            }
            throw err;
        }

        const { errors, warnings } = checkRuleFile(rule);
        if (errors.length > 0) {
            res.status(400).json({ ok: false, error: 'invalid_rule', details: errors });
            return;
        }
        const seed = body.seed;
        if (seed !== undefined && seed !== null && !(typeof seed === 'number' && Number.isInteger(seed))) {
            res.status(400).json({ ok: false, error: 'invalid_seed', message: 'seed は整数です' });
            return;
        }
        initWorld(rule as RuleFile, { seed: (seed ?? undefined) as number | undefined, ref });

        const world = getWorld();
        const experiment = body.experimentName;
        world.experimentName = typeof experiment === 'string' && experiment.length !== 0 ? experiment : null;

        broadcastAdminState(world);
        res.json({ ok: true, rule: ref, seed: world.ruleFile?.constants.seed, warnings });
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

        // ライブラリのルールを使っていたら、その版をロックする
        if (world.ruleRef !== null) {
            try {
                lockRule(world.ruleRef, basename(path));
            } catch (err) {
                console.error('[rules] ロックに失敗しました', err);
            }
        }


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

    return router;
}

function broadcastGameState(running: boolean , reset: boolean): void {
  const msg: GameStateMessage = { type: 'game_state', running , reset};
  const connections = getAllConnections();
  for (const ws of connections) {
    ws.send(JSON.stringify(msg));
  }
}