import type { Direction, Player, Position } from '../domain.js';
import type { Rng } from '../rng.js';

export const DIR_TO_VEC: Readonly<Record<Direction, { dx: number; dy: number }>> = {
    N: { dx: 0, dy: -1 },
    E: { dx: 1, dy: 0 },
    S: { dx: 0, dy: 1 },
    W: { dx: -1, dy: 0 },
};

/** トーラス上で座標を 0〜n-1 に収める */
export function wrap(v: number, n: number): number {
    return ((v % n) + n) % n;
}

/** pos にいる自分以外のプレイヤー（いなければ null） */
export function getPlayerAt(
    pos: Position,
    players: ReadonlyMap<string, Readonly<Player>>,
    selfUid: string,
): Readonly<Player> | null {
    for (const other of players.values()) {
        if (other.uid === selfUid) {
            continue;
        }
        if (other.pos.x === pos.x && other.pos.y === pos.y) {
            return other;
        }
    }
    return null;
}

/** プレイヤーがいないマスを rng で1つ選ぶ（空きが無ければ null） */
export function findFreePosition(
    nx: number,
    ny: number,
    players: ReadonlyMap<string, Readonly<Player>>,
    rng: Rng,
): Position | null {
    const used = new Set<string>();
    for (const p of players.values()) {
        used.add(`${p.pos.x}, ${p.pos.y}`);
    }

    const free: Position[] = [];
    for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
            if (!used.has(`${x}, ${y}`)) {
                free.push({ x, y });
            }
        }
    }
    if (free.length === 0) {
        return null;
    }
    return free[Math.floor(rng() * free.length)];
}
