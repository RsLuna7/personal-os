import { isHttpUrl, normalizeLinkUrl } from './links'

describe('normalizeLinkUrl', () => {
  it.each([
    ['example.com', 'https://example.com/'],
    ['example.com/a?b=1#c', 'https://example.com/a?b=1#c'],
    ['  https://a.com/x  ', 'https://a.com/x'],
    ['http://a.com', 'http://a.com/'],
    ['example.com:8080/x', 'https://example.com:8080/x'],
  ])('turns %j into %j', (input, expected) => {
    expect(normalizeLinkUrl(input)).toBe(expected)
  })

  it.each([
    [''],
    ['   '],
    ['javascript:alert(1)'],
    ['JAVASCRIPT:alert(1)'],
    ['data:text/html,<b>x</b>'],
    ['file:///c:/x'],
    ['ftp://a.com'],
    ['hello world'],
    ['mailto:a@b.com'],
  ])('rejects %j', (input) => {
    expect(normalizeLinkUrl(input)).toBeNull()
  })
})

describe('isHttpUrl', () => {
  it('accepts http and https urls', () => {
    expect(isHttpUrl('https://a.com')).toBe(true)
    expect(isHttpUrl('http://a.com/x?y=1')).toBe(true)
  })

  it.each([['a.com'], ['javascript:1'], ['']])('rejects %j', (input) => {
    expect(isHttpUrl(input)).toBe(false)
  })
})
