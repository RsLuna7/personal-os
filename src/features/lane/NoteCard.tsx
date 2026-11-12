import { useEffect, useId, useRef } from 'react'
import { NOTE_MAX, type Lane } from '@/data/schema'
import { useStore } from '@/data/store'
import { useDraft } from '@/features/editor/fields'

/** 板块备注：纯文本，失焦时保存。 */
/** 字数到这里才显示计数，离上限还远时不占地方 */
export const NOTE_WARN_AT = 1800
const NOTE_MIN_ROWS = 2
const NOTE_MAX_ROWS = 12

export function NoteCard({ lane }: { lane: Lane }) {
  const updateLane = useStore((state) => state.updateLane)
  const [draft, setDraft] = useDraft(lane.note)
  const titleId = useId()
  const over = draft.length - NOTE_MAX
  // 框的高度跟着内容走（两行到十二行），写了几行就显示几行，不用点进去才看得全
  const lines = draft.split('\n').length
  const rows = Math.min(NOTE_MAX_ROWS, Math.max(NOTE_MIN_ROWS, lines))
  const showCount = draft.length >= NOTE_WARN_AT

  const save = () => {
    if (draft === lane.note || over > 0) return
    updateLane(lane.id, { note: draft })
  }

  // 没有失焦就离开（刷新、关页、后退、被卸载）时，把写了一半的草稿存下来
  const latest = useRef({ laneId: lane.id, draft })
  useEffect(() => {
    latest.current = { laneId: lane.id, draft }
  })
  useEffect(() => {
    const flush = () => {
      const { laneId, draft: text } = latest.current
      const current = useStore.getState().data.lanes.find((item) => item.id === laneId)
      if (!current || current.note === text || text.length > NOTE_MAX) return
      useStore.getState().updateLane(laneId, { note: text })
    }
    // 捕获阶段：赶在存储层处理 pagehide 之前写进 store
    window.addEventListener('pagehide', flush, true)
    return () => {
      window.removeEventListener('pagehide', flush, true)
      flush()
    }
  }, [])

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-[16px] bg-(--bg-card) p-5 shadow-(--shadow-card)"
    >
      <h2 id={titleId} className="mb-3 font-serif text-[18px] font-bold text-(--text)">
        备注
      </h2>
      <textarea
        aria-label="板块备注"
        value={draft}
        placeholder="写点什么：目标、注意事项……"
        rows={rows}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        // 支持 field-sizing 的浏览器连自动换行也算进高度；不支持的按换行数（rows）
        className="max-h-[calc(12lh+1rem+2px)] min-h-[calc(2lh+1rem+2px)] w-full resize-none [field-sizing:content] rounded-[8px] border border-(--border) bg-(--bg-page) px-3 py-2 text-[14px] leading-relaxed text-(--text) placeholder:text-(--text-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text)"
      />
      {/* 离上限还远时底下这一行整个不占地方；over > 0 时 showCount 必然为真 */}
      {showCount && (
        <div className="mt-1 flex justify-between gap-2 text-[12px]">
          {over > 0 ? (
            <p role="alert" className="text-(--danger)">
              超出 {over} 字，缩短后才能保存
            </p>
          ) : (
            <span />
          )}
          <span className={over > 0 ? 'text-(--danger)' : 'text-(--text-muted)'}>
            {draft.length} / {NOTE_MAX}
          </span>
        </div>
      )}
    </section>
  )
}
