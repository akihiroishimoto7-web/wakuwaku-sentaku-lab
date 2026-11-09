import { speak } from '../speech'
import { useStore } from '../store'
import { CHAPTERS, GUIDES, fullRoute } from '../tour'
import { OverviewBanner } from './OverviewBanner'

// たんけんツアー中の画面（スマホで子どもが見やすいように、文字は短く、ボタンは大きく）
export function TourUI() {
  const ch = useStore((s) => s.tourCh)
  const paused = useStore((s) => s.tourPaused)
  const done = useStore((s) => s.tourDone)
  const slow = useStore((s) => s.slow)
  const muted = useStore((s) => s.muted)
  const tourAt = useStore((s) => s.tourAt)
  const ov = useStore((s) => s.tourOv)
  const st = useStore.getState()
  const c = CHAPTERS[ch]
  const g = GUIDES[ch]
  const last = ch === CHAPTERS.length - 1

  return (
    <>
      <div id="tour-fx" className="tour-fx" aria-hidden="true" />
      <div key={tourAt} className="shrink-overlay">
        <span>みずの つぶに へんしん！</span>
      </div>

      <header className="tour-head">
        <div className="th-title">
          <span className="th-drop">💧</span>
          <b>だいぼうけん</b>
          <span className="th-count">
            {ch + 1}
            <small>/{CHAPTERS.length}</small>
          </span>
        </div>
        <div className="th-actions">
          <button className={`th-btn ${slow ? 'on' : ''}`} onClick={st.toggleSlow} aria-label={slow ? 'ふつうの はやさ' : 'ゆっくり'}>
            🐢
          </button>
          <button className="th-btn" onClick={st.toggleMute} aria-label={muted ? 'おとを だす' : 'おとを けす'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="th-btn close" onClick={st.exitTour} aria-label="たんけんを おわる">
            ✕
          </button>
        </div>
      </header>

      {done && <div className="master">🏅 たんけん クリア！</div>}
      {ov && <OverviewBanner first={ch === 0} />}

      <div className="dock tour-dock">
        <div className="tour-card" key={ch}>
          <button
            className="tour-mapbtn"
            onClick={() => {
              st.showOverview()
              speak('いまは ここ！ きいろの みちを すすむよ')
            }}
            aria-label="ぜんたいを みる"
          >
            <TourMap ch={ch} />
            <span className="mm-zoom">🗺️ ぜんたい</span>
          </button>
          <div className="tc-body">
            <div className="tc-title">
              <span className="tc-icon">{c.icon}</span>
              <b>{c.title}</b>
            </div>
            <p className="tc-short">{g.short}</p>
            <button className="tc-listen" onClick={() => speak(`${c.title}。${c.text}`)} disabled={muted}>
              🔊 きく
            </button>
          </div>
        </div>
        {done ? (
          <div className="tour-nav">
            <button className="big primary" onClick={() => st.gotoChapter(0)}>
              🔁 もういちど
            </button>
            <button className="big sub" onClick={st.exitTour}>
              🏠 おわる
            </button>
          </div>
        ) : (
          <div className="tour-nav">
            <button className="nav" onClick={() => st.gotoChapter(ch - 1)} disabled={ch === 0} aria-label="まえ">
              ◀
            </button>
            <button className={`nav play ${paused ? 'paused' : ''}`} onClick={st.toggleTourPause}>
              {paused ? '▶ つづける' : '⏸ とめる'}
            </button>
            <button className="nav" onClick={() => st.gotoChapter(ch + 1)} disabled={last} aria-label="つぎ">
              ▶
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// 洗濯機の断面図の上を、しずくが進んでいく「いまここ地図」
// しずくの位置と通った道は、3D側（Tour.tsx）が毎フレーム書きかえる
function TourMap({ ch }: { ch: number }) {
  const f = GUIDES[ch].focus
  const st = useStore.getState()
  return (
    <svg className="tour-minimap" viewBox="0 0 100 100" role="img" aria-label="いま いる ばしょ">
      <rect x="7" y="3" width="86" height="94" rx="9" className="mm-body" />
      {/* 上の部分：給水の管・洗剤入れ・乾燥ユニット */}
      <path d="M80 13 L60 11 L36 11 L28 13" className="mm-pipe" />
      <path d="M23 19 L31 27" className="mm-pipe" />
      <rect x="13" y="9" width="20" height="9" rx="2" className="mm-drawer" />
      <rect x="16" y="13" width="14" height="3" rx="1" className="mm-det" />
      <rect x="40" y="15" width="12" height="7" rx="1.5" className="mm-hot" />
      <rect x="52" y="15" width="12" height="7" rx="1.5" className="mm-cold" />
      <circle cx="80" cy="13" r="4" className="mm-valve" />
      {/* 外槽とドラム */}
      <circle cx="50" cy="56" r="31" className="mm-tub" />
      <path d="M24 66 A27 27 0 0 0 76 66 Z" className="mm-water" />
      <circle cx="50" cy="56" r="25" className="mm-drum" />
      <circle cx="50" cy="56" r="23.5" className="mm-holes" />
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2
        return <circle key={i} cx={50 + Math.cos(a) * 21} cy={56 + Math.sin(a) * 21} r="2.2" className="mm-lifter" />
      })}
      {/* 排水 */}
      <path d="M51 87 L62 89 L70 88" className="mm-drain" />
      <path d="M78 88 L86 86 L88 60 L88 24 L93 19 L97 24" className="mm-drain" />
      <circle cx="74" cy="88" r="4.5" className="mm-pump" />
      <path d="M33 86 L29 95 M67 86 L71 95" className="mm-damper" />
      {/* 道 */}
      <polyline points={fullRoute()} className="mm-route" />
      <polyline id="tour-trail" points="" className="mm-trail" />
      <circle cx={f[0]} cy={f[1]} r="7" className="mm-focus" />
      <g id="tour-dot" transform="translate(99 2)">
        <circle r="5.5" className="mm-dot-halo" />
        <path d="M0 -4.6 C2.6 -1.4 3.6 0.4 3.6 1.6 A3.6 3.6 0 0 1 -3.6 1.6 C-3.6 0.4 -2.6 -1.4 0 -4.6 Z" className="mm-dot" />
      </g>
      {st.tourDone && <text x="50" y="60" textAnchor="middle" fontSize="16">🎉</text>}
    </svg>
  )
}
