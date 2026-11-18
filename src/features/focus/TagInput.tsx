import { useId, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { TAG_MAX } from '@/data/schema'
import { tagColor } from './stats'

/** 最多同时摆出的历史标签 */
const SUGGESTION_MAX = 6

interface TagInputProps {
  value: string
  onChange: (value: string) => void
  /** 历史标签，最近用过的在前 */
  history: string[]
  label?: string
  autoFocus?: boolean
  onEnter?: () => void
}

/** 标签输入：可以直接输入新标签；输入时下面一行只留匹配的历史标签，点一下填入，Tab 补全第一个。 */
export function TagInput({
  value,
  onChange,
  history,
  label = '标签',
  autoFocus,
  onEnter,
}: TagInputProps) {
  const id = useId()
  const typed = value.trim()
  const matches = history.filter((tag) => tag.includes(typed)).slice(0, SUGGESTION_MAX)
  const completion =
    typed === '' ? undefined : history.find((tag) => tag.startsWith(typed) && tag !== typed)

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab' && !event.shiftKey && completion) {
      event.preventDefault()
      onChange(completion)
    } else if (event.key === 'Enter' && onEnter) {
      event.preventDefault()
      onEnter()
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        maxLength={TAG_MAX}
        placeholder="标签，如：学习"
        autoComplete="off"
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {matches.length > 0 && (
        <div role="group" aria-label="历史标签" className="flex flex-wrap gap-1">
          {matches.map((tag) => (
            <button
              key={tag}
              type="button"
              data-lane-color={tagColor(tag)}
              aria-pressed={tag === typed}
              onClick={() => onChange(tag)}
              className="lane-chip"
            >
              <span aria-hidden className="lane-chip-dot" />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
