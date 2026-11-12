import { render, screen } from '@testing-library/react'
import { App } from './App'

it('renders the product name', () => {
  render(<App />)
  const brand = screen.getByTitle('Kairos OS · 个人 OS')
  expect(brand).toHaveTextContent('KairosOS')
})
