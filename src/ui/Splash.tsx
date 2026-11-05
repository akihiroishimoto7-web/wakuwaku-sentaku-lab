import { useStore } from '../store'
import { ZukanButton } from './Zukan'

// はじめの画面：あそびかたを3つから選ぶ（最初のタップで音と読み上げも有効になる）
export function Splash() {
  const splash = useStore((s) => s.splash)
  const close = useStore((s) => s.closeSplash)
  if (!splash) return null
  return (
    <div className="splash" role="dialog" aria-label="わくわく せんたくき ラボ">
      <div className="bubbles" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.7) % 6}s`, width: 14 + ((i * 13) % 34), height: 14 + ((i * 13) % 34) }} />
        ))}
      </div>
      <div className="splash-card">
        <p className="splash-kicker">せんたくきの ひみつを さがそう</p>
        <h1 className="splash-title">
          <span>わくわく</span>
          <span className="t2">せんたくき</span>
          <span className="t3">ラボ</span>
        </h1>
        <div className="splash-actions">
          <button className="go wash" onClick={() => close('wash')}>
            <b>🫧</b>
            <span>
              せんたく する
              <small>ふくを いれて じぶんで あらう</small>
            </span>
          </button>
          <button className="go tour" onClick={() => close('tour')}>
            <b>🔦</b>
            <span>
              たんけん する
              <small>みずの つぶに なって なかを たびする</small>
            </span>
          </button>
          <button className="go exp" onClick={() => close('experiment')}>
            <b>🧪</b>
            <span>
              じっけん する
              <small>どの あらいかたが きれいに なる？</small>
            </span>
          </button>
        </div>
        <div className="splash-links">
          <ZukanButton />
          <a className="lab-link fan-link" href="./fan/">
            🌀 せんぷうき ラボへ
          </a>
        </div>
        <p className="splash-note">🔊 おとと こえが でるよ</p>
      </div>
    </div>
  )
}
