import { useEffect } from 'react'
import { closeBook, countGot, openBook, shiftToast, STAMPS, useStamps, type Lab } from '../stamps'

// リンクは「もう ひとつの ラボ」から みた ばしょ（せんたくき ＝ /、せんぷうき ＝ /fan/）
const LAB_INFO: Record<Lab, { icon: string; name: string; href: string }> = {
  wash: { icon: '🫧', name: 'せんたくき ラボ', href: '../' },
  fan: { icon: '🌀', name: 'せんぷうき ラボ', href: './fan/' },
}

// 「シール ゲット！」の おしらせ。タップすると ずかんが ひらく
export function StampToast({ onShow }: { onShow?: () => void }) {
  const { queue } = useStamps()
  const cur = queue[0]
  useEffect(() => {
    if (!cur) return
    onShow?.()
    const t = setTimeout(shiftToast, 3200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur])
  if (!cur) return null
  return (
    <button className="stamp-toast" key={cur.id} onClick={openBook} aria-live="polite">
      <span className="st-sticker" style={{ background: cur.color }}>
        {cur.icon}
      </span>
      <span className="st-text">
        <small>シール ゲット！</small>
        <b>{cur.name}</b>
        <em>ずかんを みる ›</em>
      </span>
    </button>
  )
}

export function ZukanButton() {
  const { got } = useStamps()
  const n = countGot(got)
  return (
    <button className="zukan-btn" onClick={openBook}>
      📒 はっけん ずかん
      <span className="zk-count">
        {n}/{STAMPS.length}
      </span>
    </button>
  )
}

export function ZukanBook({ lab }: { lab: Lab }) {
  const { got, seen, book } = useStamps()
  useEffect(() => {
    if (!book) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeBook()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [book])
  if (!book) return null
  const n = countGot(got)
  const all = n === STAMPS.length
  const order: Lab[] = lab === 'wash' ? ['wash', 'fan'] : ['fan', 'wash']
  return (
    <div className="zukan" role="dialog" aria-label="はっけん ずかん" onClick={closeBook}>
      <div className="zk-card" onClick={(e) => e.stopPropagation()}>
        <header className="zk-head">
          <b>📒 はっけん ずかん</b>
          <span>
            {n} / {STAMPS.length} まい
          </span>
          <button className="pill icon" onClick={closeBook} aria-label="とじる">
            ✕
          </button>
        </header>
        <div className="zk-bar">
          <i style={{ width: `${(n / STAMPS.length) * 100}%` }} />
        </div>
        {all ? (
          <p className="zk-all">🏆 ぜんぶ あつめたね！ きみは わくわく ラボ はかせ！</p>
        ) : (
          <p className="zk-lead">はっけん すると シールが もらえるよ。？ の したの ヒントを みてね</p>
        )}
        <div className="zk-scroll">
          {order.map((l) => {
            const list = STAMPS.filter((s) => s.lab === l)
            const info = LAB_INFO[l]
            const here = l === lab
            return (
              <section key={l} className="zk-sec">
                <h3>
                  {info.icon} {info.name}
                  <small>
                    {list.filter((s) => got[s.id]).length}/{list.length}
                  </small>
                  {!here && (
                    <a className="zk-go" href={info.href}>
                      いってみる ›
                    </a>
                  )}
                </h3>
                <ul className="zk-grid">
                  {list.map((s, i) => {
                    const ok = !!got[s.id]
                    const prog = s.total ? Math.min(s.total, seen[s.id]?.length ?? 0) : 0
                    return (
                      <li key={s.id} className={ok ? 'ok' : 'no'}>
                        <span className="zk-sticker" style={ok ? { background: s.color, rotate: `${((i * 7) % 13) - 6}deg` } : undefined}>
                          {ok ? s.icon : '？'}
                        </span>
                        <b>{ok ? s.name : s.hint}</b>
                        {!ok && s.total ? (
                          <small>
                            {prog}/{s.total}
                          </small>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
        <p className="zk-note">※ シールは この たんまつの ブラウザに だけ ほぞん されるよ</p>
      </div>
    </div>
  )
}
