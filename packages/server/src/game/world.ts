import {
  createRngSet,
  gameParamsFromRuleFile,
  resolveRuntime,
  type GameParams,
  type Player,
  type RngSet,
  type RuleFile,
  type RuleRef,
  type RuntimeConfig,
  type RuntimeHooks,
  type ArtifactValue,
} from "@game/shared";

export interface World {
    initialized: boolean;
    running: boolean;
    params: GameParams | null;
    map: {
        nx: number;
        ny: number;
        blockMax: number;
        data: number[][];
    } | null;
    players: Map<string, Player>;
    energyTable: number[] | null;
    fusionTable: number[][] | null;
    experimentName: string | null;
    logPath: string | null;
    rngs: RngSet | null;
    /** 各フックに差しているルールの設定（meta.json に記録する） */
    runtimeConfig: RuntimeConfig | null;
    /** 各フックに差している関数 */
    runtime: RuntimeHooks | null;
    /** 使っているルールファイル（シードの上書きを反映したもの） */
    ruleFile: RuleFile | null;
    /** ライブラリから読んだ場合はその場所。それ以外（直接渡された・旧形式の params）は null */
    ruleRef: RuleRef | null;
    /** ルールファイルの全 artifact の結果（名前で引く） */
    artifacts: Record<string, ArtifactValue>;
    /** 何回目のティックか（開始から数える。events.jsonl に記録する） */
    tick: number;
}

export function createWorld(): World {
    return {
        initialized: false, running: false, params: null, map: null, players: new Map(), energyTable: null, fusionTable: null, experimentName: null, logPath: null, rngs: null, runtimeConfig: null, runtime: null, ruleFile: null, ruleRef: null, artifacts: {}, tick: 0
    }
}

let world: World | null = null;

export function getWorld(): World {
  if (world === null) {
    world = createWorld();
  }
  return world;
}

//worldの初期化
/**
 * ルールファイルから世界を作る。ルールファイルは checkRuleFile を通したものを渡すこと。
 * seed を渡すとルールファイルの constants.seed を上書きする（同じルールでシードだけ変えて回すため）。
 */
export function initWorld(rule: RuleFile, opts: { seed?: number; ref?: RuleRef | null } = {}): void {
  const world = getWorld();
  const seed = opts.seed ?? rule.constants.seed;
  const ruleFile: RuleFile = structuredClone({ ...rule, constants: { ...rule.constants, seed } });
  const params = gameParamsFromRuleFile(ruleFile);

  world.ruleFile = ruleFile;
  world.ruleRef = opts.ref ?? null;
  world.params = params;
  const rngs = createRngSet(seed);
  world.rngs = rngs;
  world.artifacts = Object.fromEntries(Object.entries(ruleFile.artifacts).map(([name, a]) => [name, a.baked]));
  world.energyTable = world.artifacts.energyTable as number[];
  world.fusionTable = world.artifacts.fusionTable as number[][];

  const runtimeConfig = ruleFile.runtime;
  const runtime = resolveRuntime(runtimeConfig);
  world.runtimeConfig = runtimeConfig;
  world.runtime = runtime;

  world.map = {
    nx: params.map.nx,
    ny: params.map.ny,
    blockMax: params.map.blockMax,
    data: runtime.initMap({
      params,
      rng: rngs.initMap,
      artifacts: { ...world.artifacts, energyTable: world.energyTable, fusionTable: world.fusionTable },
      log: () => {},
    }),
  };
  world.players.clear();   // (a) を採用する場合
  // 初期化したら前の実験は終わり。開始するまで行動は処理せず、前の実験のログにも書かない
  world.running = false;
  world.logPath = null;
  world.tick = 0;
  world.initialized = true;
}

export function startGame(): boolean {
  const world = getWorld();
  if (!world.initialized) {
    return false;
  }
  world.running = true;
  return true;
}

export function stopGame(): void {
  const world = getWorld();
  world.running = false;
}
