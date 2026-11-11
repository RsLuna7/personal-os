import { useId } from 'react'
import { NOTE_MAX, type Lane } from '@/data/schema'
import { useStore } from '@/data/store'
import { useDraft } from '@/features/editor/fields'

/** 板块备注：纯文本，失焦时保存。 */
export function NoteCard({ lane }: { lane: Lane }) {
  const updateLane = useStore((state) => state.updateLane)
  const [draft, setDraft] = useDraft(lane.note)
  const titleId = useId()
  const over = draft.length - NOTE_MAX

  const save = () => {
    if (draft === lane.note || over > 0) return
    updateLane(lane.id, { note: draft })
  }

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
        rows={5}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        className="w-full resize-y rounded-[8px] border border-(--border) bg-(--bg-page) px-3 py-2 text-[14px] leading-relaxed text-(--text) placeholder:text-(--text-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text)"
      />
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
    </section>
  )
}
