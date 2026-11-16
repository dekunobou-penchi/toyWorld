import { useContext, useState } from "react";
import { AdminContext } from "../context/AdminContext";
import { AdminMapView } from "../components/AdminMapView";

import { DEFAULT_GAME_PARAMS, GameParams, TransitionMode } from "@game/shared";
import styles from './Admin.module.css';

export function Admin() {

  const [params, setParams] = useState(DEFAULT_GAME_PARAMS);
  const [experimentName, setExperimentName] = useState('');
  const ctx = useContext(AdminContext);
    if(!ctx) {
    throw new Error('AdminContextが見つかりません');
  }

  function handleInit(){

    const body = {
      params: params,
      experimentName: experimentName,

    }
    const data = JSON.stringify(body);
    fetch('/api/admin/init', {
      method: 'POST',     
      headers: { 'Content-Type': 'application/json'},
      body: data    
    })
    
  }





  return (
    <div>
      <div>
        <h2>管理者画面</h2>
      </div>
      <div>
        <p>稼働状況: {ctx.running ? 'true' : 'false'}</p>
        <p>プレイヤー数: {ctx.players.length}</p>
        <p>マップの有無: {ctx.map !== null ? 'true' : 'false'}</p>
      </div>
      <div>
        {ctx.map && <AdminMapView nx={ctx.map.nx} ny={ctx.map.ny} data={ctx.map.data} players={ctx.players} /> }
      </div>
      <div>
        <table>
          <thead>
            <tr>
              <th>名前</th>
              <th>位置</th>
              <th>方向</th>
              <th>LP</th>
              <th>保持ブロック</th>
              <th>生存時間</th>
              <th>最長生存時間</th>
            </tr>
          </thead>
          <tbody>
            {ctx.players.map((player) => (
              <tr key={player.uid}>
                <td>{player.profile.name}</td>
                <td>({player.pos.x}, {player.pos.y})</td>
                <td>{player.dir}</td>
                <td>{player.lp}</td>
                <td>{player.hold}</td>
                <td>{player.Ltime}</td>
                <td>{player.Ltmax}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <input
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if(file){
                const reader = new FileReader();
                reader.onload = () => {
                  const text = reader.result;
                  console.log(text);
                  fetch('/api/admin/init', {
                    method: 'POST',     
                    headers: { 'Content-Type': 'application/json'},
                    body: text,             
                  })
                }
                reader.readAsText(file);
            }
          }}
        />
      </div>

      <div>
        <input
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if(file){
                const reader = new FileReader();
                reader.onload = () => {
                  const text = reader.result;
                  console.log(text);
                  fetch('/api/admin/energy-table', {
                    method: 'POST',     
                    headers: { 'Content-Type': 'application/json'},
                    body: text,             
                  })
                }
                reader.readAsText(file);
            }
          }}
        />
      </div>
      <div>
        <input
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if(file){
                const reader = new FileReader();
                reader.onload = () => {
                  const text = reader.result;
                  console.log(text);
                  fetch('/api/admin/fusion-table', {
                    method: 'POST',     
                    headers: { 'Content-Type': 'application/json'},
                    body: text,             
                  })
                }
                reader.readAsText(file);
            }
          }}
        />
      </div>
      <div>
        <h3>初期設定</h3>
        <label>遷移時間: </label>
        <input
          type="number"
          value={params.tickIntervalSec}
          onChange={(e) => setParams({...params, tickIntervalSec: e.target.valueAsNumber})}
        />
      </div>
      <div
        className={styles.mapForm}
      >
        <h4>MapData</h4>
        <label>Ｘ方向の長さ: 
          <input
            type="number"
            value={params.map.nx}
            onChange={(e) => setParams({...params, map: {...params.map, nx: e.target.valueAsNumber}})}
          />
        </label>
          <label>Y方向の長さ: 
          <input
            type="number"
            value={params.map.ny}
            onChange={(e) => setParams({...params, map: {...params.map, ny: e.target.valueAsNumber}})}
          />
        </label>
        <label>ブロックの最大値: 
          <input
            type="number"
            value={params.map.blockMax}
            onChange={(e) => setParams({...params, map: {...params.map, blockMax: e.target.valueAsNumber}})}
          />
        </label>
        <label>ブロックの最小値: 
          <input
            type="number"
            value={params.map.blockMin}
            onChange={(e) => setParams({...params, map: {...params.map, blockMin: e.target.valueAsNumber}})}
          />
        </label>
      </div>

      <div
        className={styles.playerForm}
      >
        <h4>プレイヤー設定</h4>
        <label>LP初期値: 
          <input
            type="number"
            value={params.player.lpInitial}
            onChange={(e) => setParams({...params, player: {...params.player, lpInitial: e.target.valueAsNumber}})}
          />
        </label>
        <label>LP減少値: 
          <input
            type="number"
            value={params.player.lpDecreasePerTick}
            onChange={(e) => setParams({...params, player: {...params.player, lpDecreasePerTick: e.target.valueAsNumber}})}
          />
        </label>
        <label>視界: 
          <input
            type="number"
            value={params.player.viewRange}
            onChange={(e) => setParams({...params, player: {...params.player, viewRange: e.target.valueAsNumber}})}
          />
        </label>
        <label>Seed: 
          <input
            type="number"
            value={params.seed}
            onChange={(e) => setParams({...params, seed: e.target.valueAsNumber})}
          />
        </label>  
      </div>
      <div>
        <h4>モード選択</h4>
        <select value={params.transition} onChange={(e) => setParams({...params, transition: e.target.value as TransitionMode})}>
          <option value="person">person</option>
          <option value="agent">agent</option>
        </select>
      </div>
      <div>
        <h4>実験名</h4> 
        <input
          type="text"
          value={experimentName}
          onChange={(e) => setExperimentName(e.target.value)}
        />
      </div>

      <div>
        <button onClick={() => handleInit()}>初期化</button>
      </div>


    </div>

  );
}