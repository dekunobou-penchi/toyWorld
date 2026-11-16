import type { Player, Position, ViewCell, VisiblePlayer } from '../domain.js';
import { DIR_TO_VEC, findFreePosition, getPlayerAt, wrap } from './helpers.js';
import type { InitContext, RuleContext, RuleDef } from './types.js';

/*
 * 今のサーバーの挙動をそのままルールにしたもの（デフォルトルール）。
 * 乱数の使い方（何回・どの順で呼ぶか）も含めて Step 1 時点と同じにしてある。
 */

function lookupTable<T>(ctx: RuleContext | InitContext, name: unknown): T {
    const table = ctx.artifacts[name as string];
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

/** observe：向いている方向の前方 range マス。他のプレイヤーがいたらそこで視界が切れる（occlusion = false なら切れない） */
export const forwardLine: RuleDef<'observe'> = {
    name: 'forwardLine',
    hook: 'observe',
    params: {
        range: { type: 'integer', default: 5, min: 1 },
        /** false にすると他のプレイヤーがいても視界が切れない（透視） */
        occlusion: { type: 'boolean', default: true },
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
                if (params.occlusion) break;
                continue;
            }
            cells.push({ x, y, block: data[y][x], player: null });
        }
        return cells;
    },
};

/*
 * ---- Step 5 で追加したルール ----
 */

/** 分布 p（長さ N+1）を total 個に割り振る。端数は小数部分が大きい ID から順に 1 個ずつ足す（同じなら ID が小さい方） */
export function targetCounts(p: readonly number[], total: number): number[] {
    const N = p.length - 1;
    const raw = p.map((v, i) => (i === 0 ? 0 : v * total));
    const counts = raw.map((v) => Math.floor(v));
    let rest = total - counts.reduce((a, b) => a + b, 0);
    const order = Array.from({ length: N }, (_, k) => k + 1).sort((a, b) => (raw[b] - counts[b]) - (raw[a] - counts[a]) || a - b);
    for (let k = 0; rest > 0; k = (k + 1) % N, rest--) counts[order[k]]++;
    return counts;
}

/** initMap：目標分布どおりの個数のブロックを用意して、シャッフルして並べる */
export const shuffledTarget: RuleDef<'initMap'> = {
    name: 'shuffledTarget',
    hook: 'initMap',
    params: {
        target: { type: 'artifact', default: 'targetDistribution', artifactType: 'distribution' },
    },
    create: (params) => (ctx) => {
        const { nx, ny } = ctx.params.map;
        const counts = targetCounts(lookupTable<number[]>(ctx, params.target), nx * ny);
        const ids: number[] = [];
        counts.forEach((c, id) => { for (let k = 0; k < c; k++) ids.push(id); });
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(ctx.rng() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        const data: number[][] = [];
        for (let y = 0; y < ny; y++) data.push(ids.slice(y * nx, (y + 1) * nx));
        return data;
    },
};

/**
 * 補充で選ばれる確率：(1 − α)·p*(k) + α·d(k)
 * d(k) は不足分（目標個数 − 今の個数、負は 0）に比例した分布。不足が無いときは p* を使う。
 * 補充を呼ぶ時点で取ったマスは 0（空）になっているので、数えるのはそれ以外のマス。
 */
export function refillProbabilities(p: readonly number[], map: readonly (readonly number[])[], alpha: number): number[] {
    const N = p.length - 1;
    const total = map.length * (map[0]?.length ?? 0);
    const counts = new Array(N + 1).fill(0);
    for (const row of map) for (const v of row) if (v >= 1 && v <= N) counts[v]++;
    const deficit = p.map((v, k) => (k === 0 ? 0 : Math.max(0, v * total - counts[k])));
    const D = deficit.reduce((a, b) => a + b, 0);
    return p.map((v, k) => (k === 0 ? 0 : (1 - alpha) * v + alpha * (D > 0 ? deficit[k] / D : v)));
}

/** refill：目標分布と、目標に足りない分を α で混ぜた確率で選ぶ（取ったマスに出す） */
export const mixedRefill: RuleDef<'refill'> = {
    name: 'mixedRefill',
    hook: 'refill',
    params: {
        alpha: { type: 'number', default: 0.2, min: 0, max: 1, step: 0.05 },
        target: { type: 'artifact', default: 'targetDistribution', artifactType: 'distribution' },
    },
    create: (params) => (ctx) => {
        const q = refillProbabilities(lookupTable<number[]>(ctx, params.target), ctx.world.map.data, params.alpha as number);
        const u = ctx.rng();
        let acc = 0;
        for (let k = 1; k < q.length; k++) {
            acc += q[k];
            if (u < acc) return k;
        }
        return q.length - 1;
    },
};

/** 自分から見て前に f、右に s 進んだマス */
function relative(player: Readonly<Player>, f: number, s: number, nx: number, ny: number): Position {
    const { dx, dy } = DIR_TO_VEC[player.dir];
    // 右向きのベクトルは前向きを時計回りに 90° 回したもの
    const rx = -dy;
    const ry = dx;
    return { x: wrap(player.pos.x + dx * f + rx * s, nx), y: wrap(player.pos.y + dy * f + ry * s, ny) };
}

function cellAt(ctx: RuleContext, player: Readonly<Player>, pos: Position): ViewCell {
    const other = getPlayerAt(pos, ctx.world.players, player.uid);
    const visible: VisiblePlayer | null = other === null ? null : { name: other.profile.name, dir: other.dir, lp: other.lp, hold: other.hold };
    return { x: pos.x, y: pos.y, block: ctx.world.map.data[pos.y][pos.x], player: visible };
}

/**
 * observe：自分の周り（前後左右と斜め、半径 radius）のマス。自分のマスは含まない。
 * 並びは自分から見て「前の列から後ろの列へ、各列は左から右へ」。他のプレイヤーで視界は切れない。
 */
export const surround: RuleDef<'observe'> = {
    name: 'surround',
    hook: 'observe',
    params: {
        radius: { type: 'integer', default: 1, min: 1 },
    },
    create: (params) => (ctx, player) => {
        const r = params.radius as number;
        const { nx, ny } = ctx.world.map;
        const cells: ViewCell[] = [];
        for (let f = r; f >= -r; f--) {
            for (let s = -r; s <= r; s++) {
                if (f === 0 && s === 0) continue;
                cells.push(cellAt(ctx, player, relative(player, f, s, nx, ny)));
            }
        }
        return cells;
    },
};

/**
 * observe：向いている方向に広がる扇形。前に d 進んだ列では左右 d マスまで見える（d = 1〜range）。
 * 並びは「近い列から遠い列へ、各列は左から右へ」。他のプレイヤーで視界は切れない。
 */
export const cone: RuleDef<'observe'> = {
    name: 'cone',
    hook: 'observe',
    params: {
        range: { type: 'integer', default: 3, min: 1 },
    },
    create: (params) => (ctx, player) => {
        const range = params.range as number;
        const { nx, ny } = ctx.world.map;
        const cells: ViewCell[] = [];
        for (let d = 1; d <= range; d++) {
            for (let s = -d; s <= d; s++) cells.push(cellAt(ctx, player, relative(player, d, s, nx, ny)));
        }
        return cells;
    },
};
