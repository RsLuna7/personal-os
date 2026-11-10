import { create } from 'zustand'

export interface Editing {
  kind: 'phase' | 'milestone'
  id: string
  /** 打开后选中名称，方便直接改名（新建时用） */
  selectName: boolean
}

interface EditorState {
  editing: Editing | null
  /** 正在行内改名的板块 */
  renamingLaneId: string | null
  termsOpen: boolean
}

const initialState: EditorState = { editing: null, renamingLaneId: null, termsOpen: false }

/** 哪个编辑面板开着。纯界面状态，不进入数据和撤销历史。 */
export const useEditorStore = create<EditorState>()(() => initialState)

export function resetEditor(): void {
  useEditorStore.setState(initialState)
}

export function openEditor(kind: Editing['kind'], id: string, selectName = false): void {
  useEditorStore.setState({ editing: { kind, id, selectName } })
}

export function closeEditor(): void {
  useEditorStore.setState({ editing: null })
}

export function startRenamingLane(id: string | null): void {
  useEditorStore.setState({ renamingLaneId: id })
}

export function setTermsOpen(open: boolean): void {
  useEditorStore.setState({ termsOpen: open })
}
