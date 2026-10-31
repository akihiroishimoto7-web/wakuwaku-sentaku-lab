import { SPOTS, SPOT_MAP } from '../explore'
import { PHASES } from '../sim'
import { useStore } from '../store'

// ドラム探検中の画面：スタンプカード・はっけんカード・操作ボタン
export function ExploreUI() {
  const found = useStore((s) => s.found)
  const spot = useStore((s) => s.spot)
  const ride = useStore((s) => s.ride)
  const step = useStore((s) => s.step)
  const slow = useStore((s) => s.slow)
  const paused = useStore((s) => s.paused)
  const phase = useStore((s) => s.hud.phase)
  const exploreAt = useStore((s) => s.exploreAt)
  const masterAt = useStore((s) => s.masterAt)
  const st = useStore.getState()
  const running = step === 'running'
  const all = found.length === SPOTS.length
  const cur = spot ? SPOT_MAP[spot] : null

  return (
    <>
      <div key={exploreAt} className="shrink-overlay">
        <span>ちいさく なあれ〜！</span>
      </div>
      <div className="explore-top">
        <div className="ex-title">
          <b>🔦 ドラム たんけんたい</b>
          {running && phase && (
            <span className="ex-phase" style={{ background: PHASES[phase].color }}>
              いま：{PHASES[phase].label}
            </span>
          )}
        </div>
        <div className="stamps" aria-label={`はっけん ${found.length} / ${SPOTS.length}`}>
          {SPOTS.map((s) => (
            <span key={s.id} className={found.includes(s.id) ? 'got' : ''}>
              {found.includes(s.id) ? s.icon : '？'}
            </span>
          ))}
          <em>
            {found.length}/{SPOTS.length}
          </em>
        </div>
      </div>
      {masterAt > 0 && all && <div key={masterAt} className="master">🏅 たんけん マスター！</div>}
      <div className="dock">
        {cur ? (
          <div className="spotcard" key={cur.id}>
            <div className="pc-head">
              <span className="pc-icon">{cur.icon}</span>
              <b>はっけん！ {cur.name}</b>
            </div>
            <p>{cur.text}</p>
            <button className="pill back" onClick={st.closeSpot}>
              ✓ わかった
            </button>
          </div>
        ) : (
          <div className="hint">{all ? 'ぜんぶ みつけたね！ ふくを タップすると せんいの せかいへ' : '❓を さがして タップ！ ゆびで ぐるっと みまわせるよ'}</div>
        )}
        <div className="tools">
          <button className={`tool ${ride ? 'on' : ''}`} onClick={st.toggleRide}>
            <b>🌀</b>
            <span>{ride ? 'とまる' : 'いっしょにまわる'}</span>
          </button>
          {running && (
            <>
              <button className={`tool ${slow ? 'on' : ''}`} onClick={st.toggleSlow}>
                <b>🐢</b>
                <span>{slow ? 'ふつう' : 'ゆっくり'}</span>
              </button>
              <button className={`tool ${paused ? 'on' : ''}`} onClick={st.togglePause}>
                <b>{paused ? '▶️' : '⏸️'}</b>
                <span>{paused ? 'つづける' : 'とめる'}</span>
              </button>
            </>
          )}
          <button className="tool out" onClick={st.exitExplore}>
            <b>🚪</b>
            <span>そとへ でる</span>
          </button>
        </div>
      </div>
    </>
  )
}
