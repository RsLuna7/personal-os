import { act, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createEmptyData } from '@/data/schema'
import { useStore } from '@/data/store'
import { useUndoKeys } from './useUndoKeys'

const s = () => useStore.getState()
const names = () => s().data.lanes.map((lane) => lane.name)

function Harness({ enabled }: { enabled?: boolean }) {
  useUndoKeys(enabled)
  return <textarea aria-label="备注" />
}

function setup(enabled?: boolean) {
  s().hydrate({ ...createEmptyData(), lanes: [] })
  const user = userEvent.setup()
  const view = render(<Harness enabled={enabled} />)
  act(() => {
    s().addLane('甲')
  })
  return { user, ...view }
}

it('undoes with ctrl+z', async () => {
  const { user } = setup()
  expect(names()).toEqual(['甲'])
  await user.keyboard('{Control>}z{/Control}')
  expect(names()).toEqual([])
})

it('redoes with ctrl+shift+z', async () => {
  const { user } = setup()
  await user.keyboard('{Control>}z{/Control}')
  await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
  expect(names()).toEqual(['甲'])
})

it('redoes with ctrl+y', async () => {
  const { user } = setup()
  await user.keyboard('{Control>}z{/Control}')
  await user.keyboard('{Control>}y{/Control}')
  expect(names()).toEqual(['甲'])
})

it('also answers to the cmd key', async () => {
  const { user } = setup()
  await user.keyboard('{Meta>}z{/Meta}')
  expect(names()).toEqual([])
})

it('does nothing while typing in a textarea', async () => {
  const { user, getByLabelText } = setup()
  await user.click(getByLabelText('备注'))
  await user.keyboard('{Control>}z{/Control}')
  expect(names()).toEqual(['甲'])
})

it('does nothing when disabled', async () => {
  const { user } = setup(false)
  await user.keyboard('{Control>}z{/Control}')
  expect(names()).toEqual(['甲'])
})

it('leaves arrow keys, Delete and T alone', async () => {
  const { user } = setup()
  const seen: boolean[] = []
  const spy = (event: KeyboardEvent) => seen.push(event.defaultPrevented)
  window.addEventListener('keydown', spy)
  await user.keyboard('{ArrowLeft}{ArrowRight}{Delete}t')
  window.removeEventListener('keydown', spy)
  expect(seen).toEqual([false, false, false, false])
  expect(names()).toEqual(['甲'])
})
