import {
  createRngSet,
  defaultRuntimeConfig,
  resolveRuntime,
  DEFAULT_GAME_PARAMS,
  type GameParams,
  type Player,
  type RngSet,
  type RuntimeConfig,
  type RuntimeHooks,
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
}

export function createWorld(): World {
    return {
        initialized: false, running: false, params: null, map: null, players: new Map(), energyTable: null, fusionTable: null, experimentName: null, logPath: null, rngs: null, runtimeConfig: null, runtime: null
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
export function initWorld(params: GameParams): void {
  const world = getWorld();
  const seed = params.seed ?? DEFAULT_GAME_PARAMS.seed;
  const fullParams: GameParams = { ...params, seed };
  world.params = fullParams;
  const rngs = createRngSet(seed);
  world.rngs = rngs;
  world.energyTable = generateEnergyTable(fullParams.map.blockMin, fullParams.map.blockMax);
  world.fusionTable = generateFusionTable(fullParams.map.blockMin, fullParams.map.blockMax);

  // ルールファイル（Step 3）ができるまでは、GameParams から今と同じ挙動の設定を作る
  const runtimeConfig = defaultRuntimeConfig(fullParams);
  const runtime = resolveRuntime(runtimeConfig);
  world.runtimeConfig = runtimeConfig;
  world.runtime = runtime;

  world.map = {
    nx: fullParams.map.nx,
    ny: fullParams.map.ny,
    blockMax: fullParams.map.blockMax,
    data: runtime.initMap({
      params: fullParams,
      rng: rngs.initMap,
      artifacts: { energyTable: world.energyTable, fusionTable: world.fusionTable },
      log: () => {},
    }),
  };
  world.players.clear();   // (a) を採用する場合
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

export function generateEnergyTable(blockMin: number, blockMax: number): number[] {

  const energy_table: number[] = [];
  for(let block = blockMin; block < blockMax; block++){
    energy_table.push(block);
  }
  return energy_table;
}

export function generateFusionTable(blockMin: number, blockMax: number): number[][] {
  const fusion_table: number[][] = [];
  
  for(let y = blockMin; y < blockMax; y++){
    const row: number[] = [];
    for(let x = blockMin; x < blockMax; x++){
      row.push((y+x) % blockMax);
    }
    fusion_table.push(row);
  }
  return fusion_table;
}

export function conversionEnergyTable(energy: {[key: string]: number} ): number[]{
  const arr: number[] = [];
  arr[0] = 0;
  for(const [key, value]of Object.entries(energy)){
    arr[Number(key)] = value;
  }

  return arr;

}

export function conversionFusionTable(fusion: {[key: string] : {[key: string]: number}}): number[][]{
  const arr: number[][] = [];
  arr[0] = [0];
  for(const [key, value] of Object.entries(fusion)){
    arr[Number(key)] = []
    for(const [k, v] of Object.entries(value)){
      arr[Number(key)][Number(k)] = v; 
    }
  }
  return arr;


}