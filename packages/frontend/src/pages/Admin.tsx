import { useContext } from "react";
import { AdminContext } from "../context/AdminContext";
import { AdminMapView } from "../components/AdminMapView";
import { Player } from "./Player";

export function Admin() {

  const ctx = useContext(AdminContext);
    if(!ctx) {
    throw new Error('AdminContextが見つかりません');
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
      



    </div>

  );
}