import { useState } from 'react'
import { PencilIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FOCUS_NOTE_MAX, type FocusSession } from '@/data/schema'
import { useStore } from '@/data/store'
import { showDeleteToast } from '@/features/editor/deleteToast'
import { RowAction } from '@/features/today/TodayTodoRow'
import { clockTime, formatDuration, recentTags, tagColor } from './stats'
import { TagInput } from './TagInput'

interface TodayRecordsProps {
  /** 今天的记录，新的在前 */
  records: FocusSession[]
  /** 全部记录，用来给标签补全 */
  all: FocusSession[]
}

/** 今天的专注记录：时间、标签、备注、时长；悬停可以改标签和备注，或删掉。 */
export function TodayRecords({ records, all }: TodayRecordsProps) {
  const [editing, setEditing] = useState<string | null>(null)

  if (records.length === 0) {
    return <p className="py-2 text-[14px] text-(--text-muted)">今天还没有专注记录</p>
  }
  return (
    <ul>
      {records.map((record) =>
        editing === record.id ? (
          <EditRow key={record.id} record={record} all={all} onDone={() => setEditing(null)} />
        ) : (
          <li
            key={record.id}
            data-testid={`focus-${record.id}`}
            data-lane-color={tagColor(record.tag)}
            className="group flex min-h-10 items-center gap-2.5 text-[14px]"
          >
            <span className="w-[88px] shrink-0 text-[12px] text-(--text-muted) tabular-nums">
              {clockTime(record.startAt)}–{clockTime(record.endAt)}
            </span>
            <span className="lane-chip-dot shrink-0" aria-hidden />
            <span className="shrink-0 font-medium">{record.tag}</span>
            <span className="min-w-0 flex-1 truncate text-(--text-muted)" title={record.note}>
              {record.note}
            </span>
            <span className="shrink-0 text-[13px] text-(--text-muted) tabular-nums">
              {formatDuration(record.focusMs)}
            </span>
            <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-(--dur-fast) group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
              <RowAction
                label={`修改「${record.tag}」`}
                icon={PencilIcon}
                onClick={() => setEditing(record.id)}
              />
              <RowAction
                label={`删除「${record.tag}」`}
                icon={Trash2Icon}
                danger
                onClick={() => {
                  useStore.getState().removeFocus(record.id)
                  showDeleteToast(`${record.tag} ${formatDuration(record.focusMs)}`)
                }}
              />
            </span>
          </li>
        ),
      )}
    </ul>
  )
}

function EditRow({
  record,
  all,
  onDone,
}: {
  record: FocusSession
  all: FocusSession[]
  onDone: () => void
}) {
  const [tag, setTag] = useState(record.tag)
  const [note, setNote] = useState(record.note)

  const save = () => {
    if (tag.trim() === '') return
    useStore.getState().updateFocus(record.id, { tag, note })
    onDone()
  }

  return (
    <li data-testid={`focus-${record.id}`} className="py-2">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onDone()
        }}
      >
        <TagInput value={tag} onChange={setTag} history={recentTags(all)} autoFocus />
        <Input
          aria-label="备注"
          value={note}
          maxLength={FOCUS_NOTE_MAX}
          placeholder="这次做什么（选填）"
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={tag.trim() === ''}>
            保存
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            取消
          </Button>
        </div>
      </form>
    </li>
  )
}
