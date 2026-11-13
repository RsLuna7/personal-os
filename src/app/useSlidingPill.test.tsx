import { act, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { SlidingPill, useSlidingPill } from './useSlidingPill'

function List() {
  const [selected, setSelected] = useState('a')
  const ref = useRef<HTMLDivElement | null>(null)
  const pill = useSlidingPill(ref, '[aria-current="page"]')
  return (
    <div ref={ref}>
      <SlidingPill pill={pill} className="test-pill" testId="pill" />
      {['a', 'b'].map((id) => (
        <button
          key={id}
          type="button"
          data-lane-color={id === 'a' ? 'iris' : 'teal'}
          aria-current={selected === id ? 'page' : undefined}
          onClick={() => setSelected(id)}
        >
          {id}
        </button>
      ))}
    </div>
  )
}

it('puts one hidden pill behind the selected element and follows the selection', () => {
  render(<List />)
  const pill = screen.getByTestId('pill')
  expect(pill).toHaveAttribute('aria-hidden', 'true')
  expect(pill).toHaveAttribute('data-lane-color', 'iris')
  act(() => screen.getByRole('button', { name: 'b' }).click())
  expect(screen.getByTestId('pill')).toHaveAttribute('data-lane-color', 'teal')
})

it('renders nothing when nothing is selected', () => {
  function Empty() {
    const ref = useRef<HTMLDivElement | null>(null)
    const pill = useSlidingPill(ref, '[aria-current="page"]')
    return (
      <div ref={ref}>
        <SlidingPill pill={pill} testId="pill" />
      </div>
    )
  }
  render(<Empty />)
  expect(screen.queryByTestId('pill')).not.toBeInTheDocument()
})
