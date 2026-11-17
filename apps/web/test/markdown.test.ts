import { describe, expect, test } from 'bun:test'
import { renderMarkdown } from '../src/lib/markdown.ts'

describe('renderMarkdown', () => {
  test('renders paragraphs, lists, bold, italic and links', () => {
    expect(
      renderMarkdown(
        'Hello **big** *world*\n\n- one\n- two\n\n1. a\n2. b\n\n[site](https://example.com)',
      ),
    ).toBe(
      '<p>Hello <strong>big</strong> <em>world</em></p><ul><li>one</li><li>two</li></ul><ol><li>a</li><li>b</li></ol><p><a href="https://example.com" target="_blank" rel="noopener noreferrer">site</a></p>',
    )
  })

  test('escapes HTML and refuses unsafe links', () => {
    const html = renderMarkdown(
      '<img src=x onerror=alert(1)> [x](javascript:alert(1)) [y](https://a.com/"onmouseover="alert(1))',
    )
    expect(html).not.toContain('<img')
    expect(html).not.toContain('href="javascript')
    expect(html).not.toContain('" onmouseover')
    expect(html).toContain('&lt;img')
  })
})
