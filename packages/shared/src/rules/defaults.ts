import type { ViewCell, VisiblePlayer } from '../domain.js';
import { DIR_TO_VEC, findFreePosition, getPlayerAt, wrap } from './helpers.js';
import type { Artifacts, RuleContext, RuleDef } from './types.js';

/*
 * 今のサーバーの挙動をそのままルールにしたもの（デフォルトルール）。
 * 乱数の使い方（何回・どの順で呼ぶか）も含めて Step 1 時点と同じにしてある。
 */

function lookupTable<T>(ctx: RuleContext, name: unknown): T {
    const table = ctx.artifacts[name as keyof Artifacts];
    if (table === null || table === undefined) {
        throw new Error(`artifact "${String(name)}" がありません`);
    }
    return table as T;
}

/** initMap：1マスずつ独立にランダム */
export const randomMap: RuleDef<'initMap'> = {
    name: 'randomMap',
    hook: 'initMap',
    params: {},
    create: () => (ctx) => {
        const { nx, ny, blockMin, blockMax } = ctx.params.map;
        const data: number[][] = [];
        for (let y = 0; y < ny; y++) {
            const row: number[] = [];
            for (let x = 0; x < nx; x++) {
                row.push(Math.floor(ctx.rng() * (blockMax - blockMin) + blockMin));
            }
            data.push(row);
        }
        return data;
    },
};

/** refill：ランダムなID */
export const randomRefill: RuleDef<'refill'> = {
    name: 'randomRefill',
    hook: 'refill',
    params: {},
    create: () => (ctx) => {
        const { blockMin, blockMax } = ctx.world.params.map;
        return Math.floor(ctx.rng() * (blockMax - blockMin) + blockMin);
    },
};

/** fusion：表を引く */
export const fusionTableLookup: RuleDef<'fusion'> = {
    name: 'tableLookup',
    hook: 'fusion',
    params: {
        table: { type: 'artifact', default: 'fusionTable', artifactType: 'table2d' },
    },
    create: (params) => (ctx, a, b) => lookupTable<number[][]>(ctx, params.table)[a][b],
};

/** energy：表を引く */
export const energyTableLookup: RuleDef<'energy'> = {
    name: 'tableLookup',
    hook: 'energy',
    params: {
        table: { type: 'artifact', default: 'energyTable', artifactType: 'table1d' },
    },
    create: (params) => (ctx, id) => lookupTable<number[]>(ctx, params.table)[id],
};

/** respawn：ランダムな空きマスに復活 */
export const randomRespawn: RuleDef<'respawn'> = {
    name: 'randomRespawn',
    hook: 'respawn',
    params: {
        resetHold: { type: 'boolean', default: true },
        randomDir: { type: 'boolean', default: false },
    },
    create: (params) => (ctx, player) => {
        const { nx, ny } = ctx.world.map;
        const pos = findFreePosition(nx, ny, ctx.world.players, ctx.rng);
        const dirs = ['N', 'E', 'S', 'W'] as const;
        const dir = params.randomDir ? dirs[Math.floor(ctx.rng() * 4)] : player.dir;
        return {
            pos,
            dir,
            hold: params.resetHold ? 0 : player.hold,
            lp: ctx.world.params.player.lpInitial,
        };
    },
};

/** observe：向いている方向の前方 range マス。他のプレイヤーがいたらそこで視界が切れる */
export const forwardLine: RuleDef<'observe'> = {
    name: 'forwardLine',
    hook: 'observe',
    params: {
        range: { type: 'integer', default: 5, min: 1 },
    },
    create: (params) => (ctx, player) => {
        const range = params.range as number;
        const { nx, ny, data } = ctx.world.map;
        const { dx, dy } = DIR_TO_VEC[player.dir];
        const cells: ViewCell[] = [];
        for (let i = 1; i <= range; i++) {
            const x = wrap(player.pos.x + dx * i, nx);
            const y = wrap(player.pos.y + dy * i, ny);
            const other = getPlayerAt({ x, y }, ctx.world.players, player.uid);
            if (other !== null) {
                const visible: VisiblePlayer = { name: other.profile.name, dir: other.dir, lp: other.lp, hold: other.hold };
                cells.push({ x, y, block: data[y][x], player: visible });
                break;
            }
            cells.push({ x, y, block: data[y][x], player: null });
        }
        return cells;
    },
};
