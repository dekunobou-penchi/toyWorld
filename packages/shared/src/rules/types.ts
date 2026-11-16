import type { Direction, GameParams, Player, Position, ViewCell } from '../domain.js';
import type { Rng } from '../rng.js';

/**
 * ルールから見た世界（読むだけ）。
 * サーバーの World はこの形を満たすので、そのまま渡せる。
 */
export interface RuleWorld {
    params: GameParams;
    map: {
        nx: number;
        ny: number;
        data: readonly (readonly number[])[];
    };
    players: ReadonlyMap<string, Readonly<Player>>;
}

/** 生成ルールで作ったデータ。Step 3 でルールファイルの artifacts に置き換わる */
export interface Artifacts {
    energyTable: number[] | null;
    fusionTable: number[][] | null;
}

/** 環境イベントの記録用（今は何もしない。Step 5 の補充ログで使う） */
export interface RuleEvent {
    kind: string;
    [key: string]: unknown;
}

/** initMap 用。まだマップが無いので world の代わりに params を持つ */
export interface InitContext {
    params: GameParams;
    rng: Rng;
    artifacts: Readonly<Artifacts>;
    log: (event: RuleEvent) => void;
}

/** initMap 以外のフック用 */
export interface RuleContext {
    world: RuleWorld;
    rng: Rng;
    artifacts: Readonly<Artifacts>;
    log: (event: RuleEvent) => void;
}

export type RefillCause = 'get' | 'fusion';
export type FusionTarget = 'map' | 'player';

export interface RespawnResult {
    /** null なら位置はそのまま（空きマスが無いとき） */
    pos: Position | null;
    dir: Direction;
    hold: number;
    lp: number;
}

/**
 * ゲームの流れの中で「何が起きるか」を差し替える穴（フック）。
 * どのフックも world を書き換えずに値を返す。書き換えはゲームの流れ側が行う。
 */
export interface RuntimeHooks {
    /** 初期化時：初期マップ */
    initMap(ctx: InitContext): number[][];
    /** get・fusion でマップのブロックが消えた直後：補充するブロックID（呼ぶ前にマスは 0 にしてある） */
    refill(ctx: RuleContext, pos: Position, cause: RefillCause): number;
    /** fusion 実行時：融合結果 */
    fusion(ctx: RuleContext, a: number, b: number, target: FusionTarget): number;
    /** eat 実行時：得られる LP */
    energy(ctx: RuleContext, id: number): number;
    /** LP が 0 以下になった時：復活後の状態 */
    respawn(ctx: RuleContext, player: Readonly<Player>): RespawnResult;
    /** 状態配信時：エージェントに見せるマス */
    observe(ctx: RuleContext, player: Readonly<Player>): ViewCell[];
}

export type HookName = keyof RuntimeHooks;

/** ルールのパラメータの型宣言。エディタはここから入力フォームを作る */
export type ParamSpec =
    | { type: 'number'; default: number; min?: number; max?: number; step?: number }
    | { type: 'integer'; default: number; min?: number; max?: number }
    | { type: 'boolean'; default: boolean }
    | { type: 'enum'; default: string; options: readonly string[] }
    | { type: 'artifact'; default: keyof Artifacts; artifactType: 'table1d' | 'table2d' | 'distribution' };

export type ParamValues = Record<string, unknown>;

export interface RuleDef<H extends HookName = HookName> {
    name: string;
    hook: H;
    params: Record<string, ParamSpec>;
    /** パラメータを受け取って、フックに差す関数を作る */
    create(params: ParamValues): RuntimeHooks[H];
}

/** ルールファイルの runtime の1項目 */
export interface RuleSelection {
    rule: string;
    params?: ParamValues;
}

export type RuntimeConfig = { [H in HookName]: RuleSelection };
