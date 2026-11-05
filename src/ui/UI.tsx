import { useEffect, useState } from 'react'
import { CLOTHES, CLOTH_MAP, PARTS, PART_IDS, type ClothId } from '../data'
import { micro, microSteps } from '../microState'
import { laneClean, EXP_LONG } from '../scene/Experiment'
import { COURSES, COURSE_IDS, PHASES, SPIN_RPM, courseDuration } from '../sim'
import { useStore, type Step } from '../store'
import { ClothIcon } from './ClothIcon'
import { TourUI } from './TourUI'
import { Splash } from './Splash'
import { speak } from '../speech'
import { sound } from '../sound'
import { StampToast, ZukanBook } from './Zukan'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function UI() {
  const mode = useStore((s) => s.mode)
  return (
    <div className="ui">
      <TopBar />
      {mode === 'wash' && <WashUI />}
      {mode === 'micro' && <MicroUI />}
      {mode === 'experiment' && <ExperimentUI />}
      <ZoomOverlay />
      <StampToast onShow={() => sound.sparkle()} />
      <Splash />
      <ZukanBook lab="wash" />
    </div>
  )
}

function TopBar() {
  const mode = useStore((s) => s.mode)
  const muted = useStore((s) => s.muted)
  const toggleMute = useStore((s) => s.toggleMute)
  const setMode = useStore((s) => s.setMode)
  const step = useStore((s) => s.step)
  const tour = useStore((s) => s.tour)
  if (tour) return null
  return (
    <header className="topbar">
      <button className="title" onClick={() => useStore.getState().showSplash()} aria-label="はじめの がめんへ">
        <span className="logo">🫧</span>
        <span>
          わくわく<b>せんたくき</b>ラボ
        </span>
      </button>
      <div className="top-actions">
        {mode === 'wash' && (
          <button className="pill" onClick={() => setMode('experiment')} disabled={step === 'running'}>
            🧪 じっけん
          </button>
        )}
        {mode === 'experiment' && (
          <button className="pill" onClick={() => setMode('wash')}>
            🫧 せんたくへ
          </button>
        )}
        <button className="pill icon" onClick={toggleMute} aria-label={muted ? 'おとを だす' : 'おとを けす'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  )
}

// ---------------- せんたく ----------------
const STEPS = ['あける', 'えらぶ', 'いれる', 'せんざい', 'コース', 'スタート', 'とりだす']

const STEP_VOICE: Partial<Record<Step, string>> = {
  intro: 'とびらを あけて、せんたくを はじめよう',
  choose: 'ふくを えらんで、いれるを おしてね',
  detergent: 'せんざいを いれよう',
  course: 'コースを えらんで、スタート',
  done: 'おわったよ。ふくを とりだそう',
  finished: 'ぴかぴかに なったね',
}

function stepIndex(step: Step, inDrum: number, course: boolean) {
  switch (step) {
    case 'intro':
      return 0
    case 'choose':
      return inDrum ? 2 : 1
    case 'detergent':
      return 3
    case 'course':
      return course ? 5 : 4
    case 'running':
      return 5
    case 'done':
      return 6
    case 'finished':
      return 7
  }
}

function WashUI() {
  const step = useStore((s) => s.step)
  const items = useStore((s) => s.items)
  const course = useStore((s) => s.course)
  const zooming = useStore((s) => s.zooming)
  const inDrum = Object.values(items).filter((v) => v === 'drum').length
  const idx = stepIndex(step, inDrum, !!course)
  const tour = useStore((s) => s.tour)
  const xray = useStore((s) => s.xray)
  const splash = useStore((s) => s.splash)
  useEffect(() => {
    if (!tour && !splash && STEP_VOICE[step]) speak(STEP_VOICE[step])
  }, [step, tour, splash])
  if (tour) return <TourUI />

  return (
    <>
      {!xray && step !== 'running' && step !== 'done' && step !== 'finished' && (
        <ol className="steps" aria-label="せんたくの てじゅん">
          {STEPS.map((s, i) => (
            <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
              <span>{i < idx ? '✓' : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      )}
      {(step === 'running' || step === 'done') && <RunHud />}
      {!zooming && <Dock />}
    </>
  )
}

function Hint({ text }: { text: string }) {
  return <div className="hint">{text}</div>
}

function Dock() {
  const st = useStore()
  const { step, items, selected, xray, focus, paused, slow, course, result } = st
  const drumIds = CLOTHES.filter((c) => items[c.id] === 'drum').map((c) => c.id)
  const canZoom = drumIds.length > 0 && !st.doorOpen
  const running = step === 'running'

  let hint = ''
  let body: React.ReactNode = null
  switch (step) {
    case 'intro':
      hint = 'とびらを あけよう！（とびらを タップしても OK）'
      body = (
        <button className="big primary" onClick={st.openDoor}>
          🚪 とびらを あける
        </button>
      )
      break
    case 'choose':
      hint = inDrumHint(drumIds.length, !!selected)
      body = (
        <>
          <div className="tray">
            {CLOTHES.map((c) => {
              const loc = items[c.id]
              return (
                <button
                  key={c.id}
                  className={`cloth-card ${selected === c.id ? 'sel' : ''} ${loc !== 'basket' ? 'used' : ''}`}
                  onClick={() => st.select(c.id)}
                  disabled={loc !== 'basket'}
                >
                  <ClothIcon id={c.id} />
                  <span>{c.name}</span>
                  {loc === 'drum' && <i>✓</i>}
                </button>
              )
            })}
          </div>
          <div className="row">
            <button className="big primary" onClick={st.insertSelected} disabled={!selected}>
              ⬇️ いれる
            </button>
            <button className="big" onClick={st.closeDoor} disabled={drumIds.length === 0}>
              🚪 しめる
            </button>
          </div>
        </>
      )
      break
    case 'detergent':
      hint = 'せんざいを いれよう'
      body = (
        <div className="row">
          <button className="big primary" onClick={st.pourDetergent} disabled={!!st.pourStart}>
            🧴 せんざいを いれる
          </button>
          <button className="big sub" onClick={st.skipDetergent} disabled={!!st.pourStart}>
            💧 みずだけ
          </button>
        </div>
      )
      break
    case 'course':
      hint = course ? 'スタートを おそう！' : 'コースを えらんでね'
      body = (
        <>
          <div className="courses">
            {COURSE_IDS.map((c) => (
              <button key={c} className={`course ${course === c ? 'sel' : ''}`} onClick={() => st.setCourse(c)}>
                <b>{COURSES[c].icon}</b>
                <span>{COURSES[c].name}</span>
                <small>{fmt(courseDuration(c))}</small>
              </button>
            ))}
          </div>
          <button className="big start" onClick={st.start} disabled={!course}>
            ▶️ スタート
          </button>
        </>
      )
      break
    case 'done':
      hint = 'おわったよ！ ふくを とりだそう'
      body = (
        <button className="big primary" onClick={st.takeOut}>
          👕 とりだす
        </button>
      )
      break
    case 'finished':
      body = (
        <>
          {result && <ResultCard clean={result.clean} oilLeft={result.oilLeft} />}
          <div className="row">
            <button className="big primary" onClick={st.again}>
              🔁 もういっかい
            </button>
            <button className="big sub" onClick={() => st.setMode('experiment')}>
              🧪 くらべる
            </button>
          </div>
        </>
      )
      break
  }

  return (
    <div className="dock">
      {xray && !focus && <PartChips />}
      {xray && focus && <PartCard />}
      {hint && !xray && <Hint text={hint} />}
      <div className="tools">
        <button className={`tool ${xray ? 'on' : ''}`} onClick={st.toggleXray}>
          <b>{xray ? '🙈' : '👀'}</b>
          <span>{xray ? 'もどす' : 'なかをみる'}</span>
        </button>
        <button className="tool explore" onClick={st.startTour}>
          <b>🔦</b>
          <span>たんけん</span>
        </button>
        <button className="tool" onClick={() => drumIds[0] && st.startZoom(pickCloth(drumIds))} disabled={!canZoom}>
          <b>🔍</b>
          <span>もっとちかく</span>
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
      </div>
      {body}
    </div>
  )
}

let zoomPick = 0
function pickCloth(ids: ClothId[]) {
  zoomPick = (zoomPick + 1) % ids.length
  return ids[zoomPick]
}

function inDrumHint(n: number, selected: boolean) {
  if (n === 0) return selected ? 'えらんだら「いれる」を おしてね' : 'ふくを えらんでね'
  return 'ぜんぶ いれたら とびらを しめよう'
}

function RunHud() {
  const hud = useStore((s) => s.hud)
  const course = useStore((s) => s.course)
  const paused = useStore((s) => s.paused)
  const slow = useStore((s) => s.slow)
  const step = useStore((s) => s.step)
  const xray = useStore((s) => s.xray)
  const phaseLabel = hud.phase ? PHASES[hud.phase].label : ''
  useEffect(() => {
    if (phaseLabel) speak(`${phaseLabel}！`)
  }, [phaseLabel])
  if (!course) return null
  const phases = COURSES[course].phases
  const total = courseDuration(course)
  const info = hud.phase ? PHASES[hud.phase] : null
  const done = step === 'done'
  return (
    <div className={`hud ${xray ? 'compact' : ''}`}>
      <div className="hud-main">
        <div className="hud-icon" style={{ background: info?.color ?? '#ffb3cf' }}>
          {done ? '🎉' : info?.icon}
        </div>
        <div className="hud-text">
          <b>{done ? 'おわり！' : info?.label}</b>
          <p>{done ? 'ぴかぴかに なったよ' : info?.desc}</p>
        </div>
        <div className="hud-side">
          <div className="rpm">
            <b>{hud.rpm}</b>
            <small>かい/ふん</small>
          </div>
          <div className="remain">{done ? '0:00' : `のこり ${fmt(hud.remain)}`}</div>
        </div>
      </div>
      <div className="phasebar">
        {phases.map(([p, d], i) => (
          <div
            key={i}
            className={`seg ${i < hud.phaseIdx || done ? 'past' : i === hud.phaseIdx ? 'now' : ''}`}
            style={{ flex: d / total, background: PHASES[p].color }}
            title={PHASES[p].label}
          />
        ))}
      </div>
      <div className="phaselabels">
        {['きゅうすい', 'あらい', 'すすぎ', 'だっすい', ...(course === 'dry' ? ['かんそう'] : [])].map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      {hud.phase === 'spin' && (
        <div className="note">
          ⚡ さいこう {SPIN_RPM}かい/ふん！ がめんの ドラムは みやすいように ゆっくり かいているよ
        </div>
      )}
      {(paused || slow) && <div className="badge">{paused ? '⏸️ とまっているよ' : '🐢 ゆっくり モード'}</div>}
    </div>
  )
}

function ResultCard({ clean, oilLeft }: { clean: number; oilLeft: boolean }) {
  const stars = clean > 0.9 ? 3 : clean > 0.7 ? 2 : 1
  return (
    <div className="result">
      <div className="stars">{'★'.repeat(stars) + '☆'.repeat(3 - stars)}</div>
      <b>きれいど {Math.round(clean * 100)}%</b>
      <p>{oilLeft ? 'あぶらよごれが のこったよ…。せんざいを いれると もっと きれいに なるよ！' : 'みず・せんざい・うごきの ちからで ぴかぴか！'}</p>
    </div>
  )
}

function PartChips() {
  const setFocus = useStore((s) => s.setFocus)
  return (
    <div className="partchips">
      <p className="mini">ぶひんを タップしてね ／ よくある ドラムしきの しくみを かんたんにした もけいだよ</p>
      <div className="chips">
        {PART_IDS.map((id) => (
          <button key={id} className="chip" onClick={() => setFocus(id)}>
            {PARTS[id].icon} {PARTS[id].name.split('（')[0].split(' と ')[0]}
          </button>
        ))}
      </div>
    </div>
  )
}

function PartCard() {
  const focus = useStore((s) => s.focus)!
  const setFocus = useStore((s) => s.setFocus)
  const p = PARTS[focus]
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
      {p.note && <p className="mini">※ {p.note}</p>}
      <p className="mini">※ きしゅに よって しくみや ばしょは ちがうよ</p>
      <button className="pill back" onClick={() => setFocus(null)}>
        ↩︎ もどる
      </button>
    </div>
  )
}

// ---------------- 繊維の世界 ----------------
function MicroUI() {
  const det = useStore((s) => s.microDetergent)
  const idx = useStore((s) => s.microStep)
  const slow = useStore((s) => s.slow)
  const cloth = CLOTH_MAP[useStore((s) => s.microCloth)]
  const st = useStore()
  const steps = microSteps(det)
  const cur = steps[idx]
  const last = idx === steps.length - 1
  useEffect(() => {
    speak(`${cur.title}。${cur.text}`)
  }, [cur])
  return (
    <>
      <div className="micro-top">
        <div className="micro-chip">
          🔬 {cloth.name}の せんいの せかい {det ? '（せんざい あり）' : '（みずだけ）'}
        </div>
        <p className="mini">※ これは イメージ（もけい）だよ。ほんとうの おおきさや かたちとは ちがいます</p>
      </div>
      <div className="dock">
        <div className="caption" key={idx}>
          <b>{cur.title}</b>
          <p>{cur.text}</p>
          {idx >= 2 && det && idx <= 3 && (
            <div className="legend">
              <span className="lg head">● あたま＝みずが すき</span>
              <span className="lg tail">〰 しっぽ＝あぶらが すき</span>
            </div>
          )}
        </div>
        <div className="dots">
          {steps.map((s, i) => (
            <button
              key={i}
              className={i === idx ? 'now' : i < idx ? 'past' : ''}
              onClick={() => {
                micro.t = s.t + 0.01
              }}
              aria-label={s.title}
            />
          ))}
        </div>
        <div className="row">
          <button className="big primary" onClick={st.exitMicro}>
            ↩︎ もどる
          </button>
          <button className={`big sub ${slow ? 'on' : ''}`} onClick={st.toggleSlow}>
            🐢 {slow ? 'ふつう' : 'ゆっくり'}
          </button>
          {last && (
            <button className="big sub" onClick={st.replayMicro}>
              🔁 もういちど
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// 衣服へズームしていく演出（布の目が大きくなる）
function ZoomOverlay() {
  const zooming = useStore((s) => s.zooming)
  const mode = useStore((s) => s.mode)
  const [outKey, setOutKey] = useState(0)
  useEffect(() => {
    if (mode === 'micro') setOutKey((k) => k + 1)
  }, [mode])
  if (zooming) return <div className="zoom-overlay in" />
  if (mode === 'micro' && outKey) return <div key={outKey} className="zoom-overlay out" />
  return null
}

// ---------------- 実験 ----------------
function ExperimentUI() {
  const lanes = useStore((s) => s.expLanes)
  const progress = useStore((s) => s.expProgress)
  const state = useStore((s) => s.expState)
  const setLane = useStore((s) => s.setLane)
  const run = useStore((s) => s.runExperiment)
  const finals = lanes.map((l) => laneClean(l, EXP_LONG))
  const best = Math.max(...finals)
  return (
    <>
      <div className="exp-top">
        <b>どの あらいかたが いちばん きれいに なる？</b>
        <p className="mini">じょうけんを タップで かえて「くらべる」！</p>
      </div>
      <div className="dock">
        <div className="lanes">
          {lanes.map((l, i) => (
            <div key={i} className={`lane ${state === 'done' && finals[i] === best ? 'best' : ''}`}>
              <div className="lane-head">
                <b>{'①②③④'[i]}</b>
                {state === 'done' && finals[i] === best && <span>🥇</span>}
                {state !== 'idle' && <em>{Math.round(progress[i] * 100)}%</em>}
              </div>
              <div className="togs">
                <button className={`tog ${l.det ? 'on' : ''}`} onClick={() => setLane(i, { det: !l.det })} disabled={state === 'running'}>
                  <b>{l.det ? '🧴' : '💧'}</b>
                  {l.det ? 'せんざい' : 'みずだけ'}
                </button>
                <button className={`tog ${l.rot ? 'on' : ''}`} onClick={() => setLane(i, { rot: !l.rot })} disabled={state === 'running'}>
                  <b>{l.rot ? '🔄' : '⏸️'}</b>
                  {l.rot ? 'まわす' : 'まわさない'}
                </button>
                <button className={`tog ${l.long ? 'on' : ''}`} onClick={() => setLane(i, { long: !l.long })} disabled={state === 'running'}>
                  <b>{l.long ? '⏱️⏱️' : '⏱️'}</b>
                  {l.long ? 'ながい' : 'みじかい'}
                </button>
              </div>
              <div className="bar">
                <div style={{ width: `${(state === 'idle' ? 0 : progress[i]) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        {state === 'done' && <p className="exp-result">{expMessage(lanes, finals)}</p>}
        <button className="big primary" onClick={run} disabled={state === 'running'}>
          {state === 'running' ? '…あらっているよ' : state === 'done' ? '🔁 もういちど くらべる' : '🧪 くらべる！'}
        </button>
        <p className="mini">※ しくみを わかりやすく した もけいです。ほんとうの せんたくの せいのうを よそくする ものでは ありません</p>
      </div>
    </>
  )
}

function expMessage(lanes: { det: boolean; rot: boolean; long: boolean }[], finals: number[]) {
  const best = finals.indexOf(Math.max(...finals))
  const b = lanes[best]
  const parts = [b.det && 'せんざい', b.rot && 'ぐるぐる', b.long && 'ながい じかん'].filter(Boolean)
  const noDet = lanes.some((l) => !l.det)
  const tail = noDet ? ' みずだけだと、あぶらよごれが のこりやすいね。' : ''
  return `${'①②③④'[best]}が いちばん きれい！ ${parts.length ? parts.join('＋') + ' が きいたね。' : ''}${tail}`
}
