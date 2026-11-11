import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

beforeEach(() => {
  window.location.hash = ''
})

it('shows four nav items with timeline active by default', () => {
  render(<App />)
  expect(screen.getByRole('link', { name: '全局' })).toHaveAttribute('aria-current', 'page')
  for (const name of ['日历', '板块', '今日'])
    expect(screen.getByRole('link', { name })).toBeInTheDocument()
})

it('shows a placeholder for unbuilt views', async () => {
  render(<App />)
  await userEvent.click(screen.getByRole('link', { name: '今日' }))
  expect(screen.getByText('待开发')).toBeInTheDocument()
  expect(window.location.hash).toBe('#/today')
})

it('falls back to timeline for an unknown hash', () => {
  window.location.hash = '#/nope'
  render(<App />)
  expect(screen.getByRole('link', { name: '全局' })).toHaveAttribute('aria-current', 'page')
})

it('follows the hash when it changes outside the app', async () => {
  render(<App />)
  window.location.hash = '#/today'
  expect(await screen.findByRole('link', { name: '今日' })).toHaveAttribute('aria-current', 'page')
})

it('keeps the lanes item active on a lane detail address', () => {
  window.location.hash = '#/modules/some-lane'
  render(<App />)
  expect(screen.getByRole('link', { name: '板块' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '全局' })).not.toHaveAttribute('aria-current')
})

it('keeps the calendar item active on a month address', () => {
  window.location.hash = '#/calendar/2026-11'
  render(<App />)
  expect(screen.getByRole('link', { name: '日历' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '全局' })).not.toHaveAttribute('aria-current')
})
