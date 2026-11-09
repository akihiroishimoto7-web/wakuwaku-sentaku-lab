import { useEffect } from 'react'
import { speak } from '../../speech'
import { StampToast, ZukanBook, ZukanButton } from '../../ui/Zukan'
import { OverviewBanner } from '../../ui/OverviewBanner'
import { fanSound } from '../sound'
import { FAN_PARTS, FAN_PART_IDS, LEVELS, type Level } from '../data'
import { laneModel, PITCH_NAME } from '../scene/Experiment'
import { useFan, type Pitch } from '../store'
import { FAN_CHAPTERS, fanRoute } from '../tour'

export function FanUI() {
  const mode = useFan((s) => s.mode)
  const tour = useFan((s) => s.tour)
  return (
    <div className="ui">
      {!tour && <TopBar />}
      {mode === 'play' && (tour ? <TourUI /> : <PlayUI />)}
      {mode === 'experiment' && <ExperimentUI />}
      <StampToast onShow={() => fanSound.sparkle()} />
      <Splash />
      <ZukanBook lab="fan" />
    </div>
  )
}

function TopBar() {
  const mode = useFan((s) => s.mode)
  const muted = useFan((s) => s.muted)
  const st = useFan.getState()
  return (
    <header className="topbar">
      <button className="title" onClick={st.showSplash} aria-label="はじめの がめんへ">
        <span className="logo">🌀</span>
        <span>
          わくわく<b className="fan-accent">せんぷうき</b>ラボ
        </span>
      </button>
      <div className="top-actions">
        {mode === 'play' ? (
          <button className="pill" onClick={() => st.setMode('experiment')}>
            🧪 じっけん
          </button>
        ) : (
          <button className="pill" onClick={() => st.setMode('play')}>
            🌀 せんぷうきへ
          </button>
        )}
        <button className="pill icon" onClick={st.toggleMute} aria-label={muted ? 'おとを だす' : 'おとを けす'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  )
}

// ---------------- あそぶ ----------------
function PlayUI() {
  const level = useFan((s) => s.level)
  const osc = useFan((s) => s.osc)
  const xray = useFan((s) => s.xray)
  const focus = useFan((s) => s.focus)
  const rpm = useFan((s) => s.hudRpm)
  const splash = useFan((s) => s.splash)
  const st = useFan.getState()
  const info = LEVELS[level]
  useEffect(() => {
    if (!splash && level > 0) speak(`${info.name}。${info.word}`)
  }, [level, splash, info])
  const wind = Math.min(1, rpm / 1250)

  return (
    <>
      <div className={`fan-hud ${xray ? 'compact' : ''}`}>
        <div className="fh-rpm">
          <b>{rpm}</b>
          <small>かい/ふん</small>
        </div>
        <div className="fh-wind">
          <div className="fh-label">
            <span>かぜの つよさ</span>
            <em>{level === 0 && rpm > 0 ? 'とまっていく…' : info.word}</em>
          </div>
          <div className="fh-bar">
            <div style={{ width: `${wind * 100}%` }} />
            {[0.33, 0.66, 1].map((p) => (
              <i key={p} style={{ left: `${p * 100}%` }} className={wind >= p - 0.02 ? 'on' : ''}>
                🍃
              </i>
            ))}
          </div>
        </div>
      </div>

      <div className="dock">
        {xray && !focus && (
          <div className="partchips">
            <p className="mini">ぶひんを タップしてね ／ よくある せんぷうきの しくみを かんたんにした もけいだよ</p>
            <div className="chips">
              {FAN_PART_IDS.map((id) => (
                <button key={id} className="chip" onClick={() => st.setFocus(id)}>
                  {FAN_PARTS[id].icon} {FAN_PARTS[id].short}
                </button>
              ))}
            </div>
          </div>
        )}
        {xray && focus && <PartCard />}
        {!xray && <div className="hint">{level === 0 ? 'ボタンを おして かぜを だそう！' : osc ? 'くびを ふって へやじゅうに かぜを とどけるよ' : '「くびふり」も ためしてみよう'}</div>}
        <div className="levels" role="group" aria-label="かぜの つよさ">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              className={`lv ${level === l.id ? 'on' : ''}`}
              style={{ ['--lv' as string]: l.color }}
              onClick={() => st.setLevel(l.id as Level)}
              aria-pressed={level === l.id}
            >
              <b>{l.id === 0 ? '⏹' : '🌀'.repeat(l.id)}</b>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
        <div className="tools">
          <button className={`tool ${osc ? 'on' : ''}`} onClick={st.toggleOsc} aria-pressed={osc}>
            <b>↔️</b>
            <span>くびふり</span>
          </button>
          <button className={`tool ${xray ? 'on' : ''}`} onClick={st.toggleXray}>
            <b>{xray ? '🙈' : '👀'}</b>
            <span>{xray ? 'もどす' : 'なかをみる'}</span>
          </button>
          <button className="tool explore" onClick={st.startTour}>
            <b>🔦</b>
            <span>たんけん</span>
          </button>
        </div>
      </div>
    </>
  )
}

function PartCard() {
  const focus = useFan((s) => s.focus)!
  const setFocus = useFan((s) => s.setFocus)
  const p = FAN_PARTS[focus]
  useEffect(() => {
    speak(`${p.name}。${p.desc}`)
  }, [p])
  return (
    <div className="partcard" key={focus}>
      <div className="pc-head">
        <span className="pc-icon">{p.icon}</span>
        <b>{p.name}</b>
      </div>
      <p>{p.desc}</p>
      <p className="mini">※ きしゅに よって しくみや ばしょは ちがうよ</p>
      <button className="pill back" onClick={() => setFocus(null)}>
        ↩︎ もどる
      </button>
    </div>
  )
}

// ---------------- たんけん ----------------
function TourUI() {
  const ch = useFan((s) => s.tourCh)
  const paused = useFan((s) => s.tourPaused)
  const done = useFan((s) => s.tourDone)
  const slow = useFan((s) => s.slow)
  const muted = useFan((s) => s.muted)
  const tourAt = useFan((s) => s.tourAt)
  const ov = useFan((s) => s.tourOv)
  const st = useFan.getState()
  const c = FAN_CHAPTERS[ch]
  const last = ch === FAN_CHAPTERS.length - 1
  return (
    <>
      <div id="tour-fx" className="tour-fx" aria-hidden="true" />
      <div key={tourAt} className="shrink-overlay">
        <span>でんきの つぶに へんしん！</span>
      </div>
      <header className="tour-head">
        <div className="th-title">
          <span className="th-drop">{c.spark ? '⚡' : '🌬️'}</span>
          <b>だいぼうけん</b>
          <span className="th-count">
            {ch + 1}
            <small>/{FAN_CHAPTERS.length}</small>
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
      {ov && <OverviewBanner first={ch === 0} who={c.spark ? '⚡' : '🌬️'} />}
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
            <FanMap ch={ch} />
            <span className="mm-zoom">🗺️ ぜんたい</span>
          </button>
          <div className="tc-body">
            <div className="tc-title">
              <span className="tc-icon">{c.icon}</span>
              <b>{c.title}</b>
            </div>
            <p className="tc-short">{c.short}</p>
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

// 扇風機を横から見た図。案内役の位置は3D側が毎フレーム書きかえる
function FanMap({ ch }: { ch: number }) {
  const f = FAN_CHAPTERS[ch].focus
  return (
    <svg className="tour-minimap" viewBox="0 0 100 100" role="img" aria-label="いま いる ばしょ">
      <rect x="0" y="0" width="100" height="100" rx="14" className="fm-room" />
      <path d="M0 96 H100" className="fm-floor" />
      <rect x="1.5" y="66" width="5" height="10" rx="1" className="fm-outlet" />
      <path d="M4 76 V95 H12" className="fm-cord" />
      <rect x="10" y="91" width="22" height="5" rx="2.5" className="fm-body" />
      <path d="M21 91 V46" className="fm-pole" />
      <rect x="7" y="31" width="16" height="14" rx="6" className="fm-body" />
      <circle cx="11" cy="40" r="3" className="fm-gear" />
      <circle cx="15" cy="38" r="3.4" className="fm-coil" />
      <path d="M23 38 H26" className="fm-pole" />
      <ellipse cx="26.5" cy="38" rx="2.4" ry="14" className="fm-blade" />
      <path d="M24 23 Q31 38 24 53" className="fm-guard" />
      <path d="M29 23 Q36 38 29 53" className="fm-guard" />
      <path d="M62 96 V41" className="fm-stick" />
      <circle cx="62" cy="40" r="4.5" className="fm-pin" />
      <path d="M50 96 V12 H58 V18" className="fm-stick" />
      <path d="M55 18 Q58 13 61 18 Z" className="fm-bell" />
      <rect x="57.3" y="19" width="1.6" height="8" className="fm-strip" />
      <rect x="82" y="30" width="12" height="22" rx="5" className="fm-skin" />
      <polyline points={fanRoute()} className="mm-route" />
      <polyline id="tour-trail" points="" className="mm-trail" />
      <circle cx={f[0]} cy={f[1]} r="7" className="mm-focus" />
      <g id="tour-dot" transform="translate(4 72)">
        <circle r="5.5" className="mm-dot-halo" />
        <circle r="3.4" className="mm-dot" />
      </g>
    </svg>
  )
}

// ---------------- じっけん ----------------
const PITCHES: Pitch[] = ['flat', 'mid', 'steep']
const NEXT_BLADES: Record<number, 3 | 5 | 7> = { 3: 5, 5: 7, 7: 3 }

function ExperimentUI() {
  const lanes = useFan((s) => s.lanes)
  const state = useFan((s) => s.expState)
  const progress = useFan((s) => s.expProgress)
  const st = useFan.getState()
  const finals = lanes.map((l) => laneModel(l).flow)
  const best = Math.max(...finals)
  return (
    <>
      <div className="exp-top">
        <b>どの はねが いちばん かぜが つよい？</b>
        <p className="mini">はねの かず・かたむき・つよさを かえて「くらべる」！</p>
      </div>
      <div className="dock">
        <div className="lanes fan-lanes">
          {lanes.map((l, i) => (
            <div key={i} className={`lane ${state === 'done' && finals[i] === best ? 'best' : ''}`}>
              <div className="lane-head">
                <b>{'①②③'[i]}</b>
                {state === 'done' && finals[i] === best && <span>🥇</span>}
                {state !== 'idle' && <em>{Math.round(progress[i] * 100)}</em>}
              </div>
              <div className="togs">
                <button className="tog on" onClick={() => st.setLane(i, { blades: NEXT_BLADES[l.blades] })} disabled={state === 'running'}>
                  <b>🌀{l.blades}</b>
                  はねの かず
                </button>
                <button className="tog on" onClick={() => st.setLane(i, { pitch: PITCHES[(PITCHES.indexOf(l.pitch) + 1) % 3] })} disabled={state === 'running'}>
                  <b>{l.pitch === 'flat' ? '➖' : l.pitch === 'mid' ? '↗️' : '⬆️'}</b>
                  {PITCH_NAME[l.pitch]}
                </button>
                <button className={`tog ${l.strong ? 'on' : ''}`} onClick={() => st.setLane(i, { strong: !l.strong })} disabled={state === 'running'}>
                  <b>{l.strong ? '💪' : '🍃'}</b>
                  {l.strong ? 'つよ' : 'よわ'}
                </button>
              </div>
              <div className="bar">
                <div style={{ width: `${(state === 'idle' ? 0 : progress[i]) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        {state === 'done' && <p className="exp-result">{expMessage(lanes, finals)}</p>}
        <button className="big primary" onClick={st.runExperiment} disabled={state === 'running'}>
          {state === 'running' ? '…まわしているよ' : state === 'done' ? '🔁 もういちど くらべる' : '🧪 くらべる！'}
        </button>
        <p className="mini">※ しくみを わかりやすく した もけいです。ほんとうの せんぷうきの せいのうを よそくする ものでは ありません</p>
      </div>
    </>
  )
}

function expMessage(lanes: { blades: number; pitch: Pitch; strong: boolean }[], finals: number[]) {
  const i = finals.indexOf(Math.max(...finals))
  const b = lanes[i]
  const tips: string[] = []
  if (b.pitch === 'mid') tips.push('はねの かたむきは「ちょうどいい」が いちばん')
  if (lanes.some((l) => l.pitch === 'flat')) tips.push('ねかせすぎると くうきを おせない')
  if (lanes.some((l) => l.pitch === 'steep')) tips.push('たてすぎると おもくて まわりにくい')
  if (lanes.some((l) => !l.strong)) tips.push('「よわ」は まわる はやさが おそい')
  return `${'①②③'[i]}が いちばん つよい かぜ！ ${tips.slice(0, 2).join('。')}。`
}

// ---------------- はじめの画面 ----------------
function Splash() {
  const splash = useFan((s) => s.splash)
  const close = useFan((s) => s.closeSplash)
  if (!splash) return null
  return (
    <div className="splash fan-splash" role="dialog" aria-label="わくわく せんぷうき ラボ">
      <div className="bubbles leaves" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <i key={i} style={{ top: `${(i * 29) % 100}%`, animationDelay: `${(i * 0.9) % 7}s` }}>
            {['🍃', '🌸', '🍃', '✨'][i % 4]}
          </i>
        ))}
      </div>
      <div className="splash-card">
        <p className="splash-kicker">かぜの ひみつを さがそう</p>
        <h1 className="splash-title">
          <span>わくわく</span>
          <span className="t2 fan-t2">せんぷうき</span>
          <span className="t3">ラボ</span>
        </h1>
        <div className="splash-actions">
          <button className="go fan-go" onClick={() => close('play')}>
            <b>🌀</b>
            <span>
              かぜを だす
              <small>ボタンを おして くびふりも ためそう</small>
            </span>
          </button>
          <button className="go tour" onClick={() => close('tour')}>
            <b>🔦</b>
            <span>
              たんけん する
              <small>でんきと かぜの つぶに なって たびする</small>
            </span>
          </button>
          <button className="go exp" onClick={() => close('experiment')}>
            <b>🧪</b>
            <span>
              じっけん する
              <small>どの はねが いちばん かぜが つよい？</small>
            </span>
          </button>
        </div>
        <div className="splash-links">
          <ZukanButton />
          <a className="lab-link" href="../">
            🫧 せんたくき ラボへ
          </a>
        </div>
        <p className="splash-note">🔊 おとと こえが でるよ</p>
      </div>
    </div>
  )
}
