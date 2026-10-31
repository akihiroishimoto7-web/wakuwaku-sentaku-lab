import { useStore } from '../store'
import { CHAPTERS } from '../tour'

// たんけんツアー中の画面：章のすごろく・ナレーション・操作ボタン
export function TourUI() {
  const ch = useStore((s) => s.tourCh)
  const paused = useStore((s) => s.tourPaused)
  const done = useStore((s) => s.tourDone)
  const slow = useStore((s) => s.slow)
  const tourAt = useStore((s) => s.tourAt)
  const st = useStore.getState()
  const c = CHAPTERS[ch]
  const last = ch === CHAPTERS.length - 1

  return (
    <>
      <div key={tourAt} className="shrink-overlay">
        <span>みずの つぶに へんしん！</span>
      </div>
      <div className="tour-top">
        <b className="tour-name">💧 みずの つぶの だいぼうけん</b>
        <ol className="tour-map" aria-label={`${ch + 1} / ${CHAPTERS.length} ばんめ`}>
          {CHAPTERS.map((k, i) => (
            <li key={i}>
              <button className={i < ch || (done && i === ch) ? 'past' : i === ch ? 'now' : ''} onClick={() => st.gotoChapter(i)} aria-label={k.title}>
                {i <= ch ? k.icon : i + 1}
              </button>
            </li>
          ))}
        </ol>
      </div>
      {done && <div className="master">🏅 たんけん クリア！</div>}
      <div className="dock">
        <div className="caption tour-cap" key={ch}>
          <div className="tc-head">
            <span className="tc-icon">{c.icon}</span>
            <div>
              <small>
                {ch + 1} / {CHAPTERS.length}
              </small>
              <b>{c.title}</b>
            </div>
          </div>
          <p>{c.text}</p>
        </div>
        {done ? (
          <div className="row">
            <button className="big primary" onClick={() => st.gotoChapter(0)}>
              🔁 もういちど
            </button>
            <button className="big sub" onClick={st.exitTour}>
              🚪 おわる
            </button>
          </div>
        ) : (
          <div className="tools">
            <button className="tool" onClick={() => st.gotoChapter(ch - 1)} disabled={ch === 0}>
              <b>⏮️</b>
              <span>まえ</span>
            </button>
            <button className={`tool ${paused ? 'on' : ''}`} onClick={st.toggleTourPause}>
              <b>{paused ? '▶️' : '⏸️'}</b>
              <span>{paused ? 'つづける' : 'とめる'}</span>
            </button>
            <button className="tool" onClick={() => st.gotoChapter(ch + 1)} disabled={last}>
              <b>⏭️</b>
              <span>つぎ</span>
            </button>
            <button className={`tool ${slow ? 'on' : ''}`} onClick={st.toggleSlow}>
              <b>🐢</b>
              <span>{slow ? 'ふつう' : 'ゆっくり'}</span>
            </button>
            <button className="tool out" onClick={st.exitTour}>
              <b>🚪</b>
              <span>おわる</span>
            </button>
          </div>
        )}
      </div>
    </>
  )
}
