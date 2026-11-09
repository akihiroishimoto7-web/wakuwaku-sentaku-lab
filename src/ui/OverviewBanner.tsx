// カメラが ひいている あいだの みだし
export function OverviewBanner({ first, who = '💧' }: { first: boolean; who?: string }) {
  return (
    <div className="tour-ov" aria-live="polite">
      <b>🗺️ ぜんたいを みてみよう</b>
      <span>
        {first ? (
          'これから この みちを ぜんぶ たびするよ'
        ) : (
          <>
            {who}が いま いる ところ。<em>きいろの みち</em>を すすむよ
          </>
        )}
      </span>
      <span className="ov-legend" aria-hidden="true">
        <i className="lg-past" />
        とおった
        <i className="lg-now" />
        いま
        <i className="lg-next" />
        これから
      </span>
    </div>
  )
}
