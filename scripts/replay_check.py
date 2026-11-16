import asyncio, json, random, glob, os
import requests
import websockets
from pathlib import Path

SERVER = "http://localhost:3000"
WS = "ws://localhost:3000"
ACTIONS = ["N", "E", "S", "W", "forward", "get", "eat", "put", "fusion"]
ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "data" / "experiments"


def init_world(seed, name):
    params = {
        # GameParams を全部書く（下の落とし穴1）
        "tickIntervalSec": 2,
        "actionsPerTick": 1,
        "reconnectTimeoutSec": 30,
        "map": {"nx": 10, "ny": 10, "blockMin": 0, "blockMax": 10},
        "player": {"lpInitial": 100, "lpDecreasePerTick": 1, "viewRange": 5},
        "transition": "agent",
        "seed": seed
    }
    r = requests.post(f"{SERVER}/api/admin/init", json={"params": params, "experimentName": name})
    print("init:", r.status_code, r.text)

def start_game():
    requests.post(f"{SERVER}/api/admin/start", json={})

async def run_once(seed, name, actions):
    init_world(seed, name)
    async with websockets.connect(WS) as ws:
        await ws.send(json.dumps({"type": "join", "profile": {"name": "replay", "age": 0, "gender": "na", "isAgent": True}}))
        await wait_for(ws, "joined")
        # joined が返ってくるのを待つ
        start_game()
        await wait_for(ws, "state")
        # 最初の state を待つ
        for a in actions:
            # 行動を送って、次の state を待つ（落とし穴2）
            await ws.send(json.dumps({"type": "action", "action": a}))
            await wait_for(ws, "state")
            pass

def find_log_dir(name):
    # data/experiments/exp_<時刻>_<name> の一番新しいものを探す（落とし穴3）
    a = EXP_DIR.glob(f"exp_*_{name}")
    b = max(a, key=lambda p: p.stat().st_mtime)

    return b
    #pass

def load_world(path):
    # world.jsonl を1行ずつ読んで、players から uid を消したリストを返す
    data_none_uid = []
    with open(path, 'r', encoding="utf-8") as f:
        for line in f:
            data = json.loads(line)
            for p in data["players"]:
                p.pop("uid",None)
            data_none_uid.append(data)
            
    return data_none_uid
    #pass

async def wait_for(ws, msg_type):
    while True:
        data = json.loads(await ws.recv())
        print("recv:", data)
        if data["type"] == msg_type:
            return data
        if data["type"] in ("join_failed", "error"):
            raise RuntimeError(f"{msg_type} を待ってたら {data} が来た")
def compare(a, b):
    print("行数:", len(a), len(b))
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            print(f"{i} 行目で不一致")
            if x["map"] != y["map"]:
                print("  マップが違う")
            if x["players"] != y["players"]:
                print("  プレイヤーが違う")
                print("  a:", x["players"])
                print("  b:", y["players"])
            return False
    if len(a) != len(b):
        print("途中までは一致したけど、行数が違う")
        return False
    return True


async def main():
    rnd = random.Random(0)
    actions = [rnd.choice(ACTIONS) for _ in range(500)]
    await run_once(42, "replay_a", actions)
    await run_once(42, "replay_b", actions)
    #await run_once(43, "replay_c", actions)
    a = load_world(os.path.join(find_log_dir("replay_a"), "world.jsonl"))
    b = load_world(os.path.join(find_log_dir("replay_b"), "world.jsonl"))
    #c = load_world(os.path.join(find_log_dir("replay_c"), "world.jsonl"))
    # a と b を比べて、最初に違った行の番号を出す
    print("a と b（同じシード）:", compare(a, b))
    #print("a と c（同じシード）:", compare(a, c))

asyncio.run(main())