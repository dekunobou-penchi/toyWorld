import { useContext, useEffect, useState } from "react";
import { AdminContext } from "../context/AdminContext";
import { AdminMapView } from "../components/AdminMapView";

interface LibrarySummary {
  name: string;
  version: number;
  locked: boolean;
  usedBy: string[];
  updatedAt: string;
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; [k: string]: unknown }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

function describeError(r: { [k: string]: unknown }): string {
  const details = Array.isArray(r.details) ? `：${(r.details as string[]).join(' / ')}` : '';
  return `${String(r.message ?? r.error ?? 'エラー')}${details}`;
}

export function Admin() {
  const [library, setLibrary] = useState<LibrarySummary[]>([]);
  const [selected, setSelected] = useState('');
  const [seedOverride, setSeedOverride] = useState('');
  const [experimentName, setExperimentName] = useState('');
  const [message, setMessage] = useState('');
  const ctx = useContext(AdminContext);

  async function refreshLibrary(select?: string) {
    const r = await fetch('/api/rules').then((res) => res.json());
    if (r.ok) {
      setLibrary(r.rules);
      if (select !== undefined) setSelected(select);
    }
  }

  useEffect(() => { refreshLibrary(); }, []);

  if(!ctx) {
    throw new Error('AdminContextが見つかりません');
  }

  async function handleInit(){
    if (selected === '') {
      setMessage('ルールを選んでください');
      return;
    }
    const [name, version] = selected.split('@');
    const seed = seedOverride === '' ? undefined : Number(seedOverride);
    const r = await postJson('/api/admin/init', { rule: { name, version: Number(version) }, seed, experimentName });
    setMessage(r.ok ? `${name} v${version}（シード ${r.seed}）で初期化しました` : `初期化できませんでした${describeError(r)}`);
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
      {ctx.distribution && (
        <div>
          <h3>目標分布とのズレ</h3>
          <p>L1：{ctx.distribution.l1.toFixed(3)}</p>
          {ctx.distribution.target.length <= 21 && (
            <table>
              <thead>
                <tr><th>ID</th><th>目標</th><th>今</th></tr>
              </thead>
              <tbody>
                {ctx.distribution.target.slice(1).map((p, i) => (
                  <tr key={i + 1}>
                    <td>{i + 1}</td>
                    <td>{p.toFixed(3)}</td>
                    <td>{ctx.distribution!.current[i + 1].toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
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
        <h3>初期化</h3>
        <p>ルールファイルはルールエディタ（<a href="http://localhost:5174" target="_blank" rel="noreferrer">http://localhost:5174</a>）で作ります。</p>
        <label>ルール: 
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">（選んでください）</option>
            {library.map((r) => (
              <option key={`${r.name}@${r.version}`} value={`${r.name}@${r.version}`}>
                {r.name} v{r.version}{r.locked ? '（ロック済み）' : '（下書き）'}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => refreshLibrary()}>一覧を更新</button>
        <div>
          <label>シード（空欄ならルールファイルの値）: 
            <input type="number" value={seedOverride} onChange={(e) => setSeedOverride(e.target.value)} />
          </label>
        </div>
        <div>
          <label>実験名: 
            <input type="text" value={experimentName} onChange={(e) => setExperimentName(e.target.value)} />
          </label>
        </div>
        <button onClick={() => handleInit()}>初期化</button>
        {message && <p>{message}</p>}
      </div>
    </div>

  );
}