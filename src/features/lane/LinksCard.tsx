import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LINKS_MAX, NAME_MAX, URL_MAX, type Lane, type Link } from '@/data/schema'
import { normalizeLinkUrl } from '@/data/links'
import { useStore } from '@/data/store'
import { showDeleteToast } from '@/features/editor/deleteToast'
import { ErrorText } from '@/features/editor/fields'

const ERROR_TITLE = '请填写标题'
const ERROR_URL = '请输入以 http 或 https 开头的网址'
const ERROR_URL_LONG = `网址太长（最多 ${URL_MAX} 字）`

function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

interface LinkFormProps {
  initial: { title: string; url: string }
  onSubmit: (value: { title: string; url: string }) => void
  onCancel: () => void
}

/** 添加和修改共用的两个输入框；不合法时提示并留在原地。 */
function LinkForm({ initial, onSubmit, onCancel }: LinkFormProps) {
  const titleId = useId()
  const urlId = useId()
  const [title, setTitle] = useState(initial.title)
  const [url, setUrl] = useState(initial.url)
  const [titleError, setTitleError] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const cleanTitle = title.trim()
    const cleanUrl = normalizeLinkUrl(url)
    setTitleError(cleanTitle === '')
    const tooLong = cleanUrl !== null && cleanUrl.length > URL_MAX
    setUrlError(cleanUrl === null ? ERROR_URL : tooLong ? ERROR_URL_LONG : null)
    if (cleanTitle === '' || cleanUrl === null || tooLong) return
    onSubmit({ title: cleanTitle, url: cleanUrl })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onCancel()
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={onKeyDown}
      noValidate
      className="flex flex-col gap-3 rounded-[10px] bg-(--bg-subtle) p-3"
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor={titleId}>标题</Label>
        <Input
          id={titleId}
          value={title}
          maxLength={NAME_MAX}
          autoFocus
          aria-invalid={titleError}
          onChange={(event) => setTitle(event.target.value)}
        />
        {titleError && <ErrorText>{ERROR_TITLE}</ErrorText>}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={urlId}>网址</Label>
        <Input
          id={urlId}
          value={url}
          inputMode="url"
          aria-invalid={urlError !== null}
          placeholder="https://"
          onChange={(event) => setUrl(event.target.value)}
        />
        {urlError && <ErrorText>{urlError}</ErrorText>}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" size="sm">
          保存
        </Button>
      </div>
    </form>
  )
}

type Mode = { kind: 'add' } | { kind: 'edit'; id: string } | null

/** 板块的资料链接：整行是链接，在新标签页打开；增删改都在卡片里完成。 */
export function LinksCard({ lane }: { lane: Lane }) {
  const addLink = useStore((state) => state.addLink)
  const updateLink = useStore((state) => state.updateLink)
  const removeLink = useStore((state) => state.removeLink)
  const [mode, setMode] = useState<Mode>(null)
  const titleId = useId()
  const full = lane.links.length >= LINKS_MAX

  const remove = (link: Link) => {
    removeLink(lane.id, link.id)
    showDeleteToast(link.title)
  }

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-[16px] bg-(--bg-card) p-5 shadow-(--shadow-card)"
    >
      <div className="mb-3 flex items-center gap-2">
        <h2 id={titleId} className="mr-auto font-serif text-[18px] font-bold text-(--text)">
          资料链接
        </h2>
        {full ? (
          <span className="text-[12px] text-(--text-muted)">最多 {LINKS_MAX} 条</span>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setMode({ kind: 'add' })}>
            <PlusIcon className="size-3.5" aria-hidden />
            添加链接
          </Button>
        )}
      </div>

      {mode?.kind === 'add' && (
        <div className="mb-3">
          <LinkForm
            initial={{ title: '', url: '' }}
            onCancel={() => setMode(null)}
            onSubmit={(value) => {
              addLink(lane.id, value)
              setMode(null)
            }}
          />
        </div>
      )}

      {lane.links.length === 0 && mode?.kind !== 'add' ? (
        <p className="text-[14px] text-(--text-muted)">还没有资料链接</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {lane.links.map((link) =>
            mode?.kind === 'edit' && mode.id === link.id ? (
              <li key={link.id}>
                <LinkForm
                  initial={link}
                  onCancel={() => setMode(null)}
                  onSubmit={(value) => {
                    updateLink(lane.id, link.id, value)
                    setMode(null)
                  }}
                />
              </li>
            ) : (
              <li key={link.id} className="group flex items-center gap-1">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-baseline gap-2 rounded-[6px] px-2 py-1.5 text-[14px] text-(--text) transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-(--bg-subtle) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text)"
                >
                  <span className="truncate font-medium" title={link.title}>
                    {link.title}
                  </span>
                  <span className="ml-auto shrink-0 text-[12px] text-(--text-muted)">
                    {hostOf(link.url)}
                  </span>
                </a>
                {/* 修改、删除平时收起，悬停或键盘聚焦到这一行才出现；触屏没有悬停，一直显示 */}
                <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-(--dur-fast) group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`修改「${link.title}」`}
                    onClick={() => setMode({ kind: 'edit', id: link.id })}
                  >
                    <PencilIcon aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`删除「${link.title}」`}
                    onClick={() => remove(link)}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  )
}
