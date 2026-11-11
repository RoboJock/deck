import assert from 'node:assert/strict'
import { test } from 'node:test'
import { answersMatch, parseCardFile } from '../src/lib/cardFile.ts'

test('a shared card file keeps complete rows and skips blanks', () => {
  const parsed = parseCardFile('front,back\nhola,hello\n\n"quoted, side","an ""answer"""\nonly-front\n\t\t\nuno\tdos\n')
  assert.deepEqual(parsed.cards, [
    { front: 'hola', back: 'hello' },
    { front: 'quoted, side', back: 'an "answer"' },
    { front: 'uno', back: 'dos' },
  ])
  assert.equal(parsed.skipped, 1)
})

test('card text is capped at the size the database accepts', () => {
  const front = 'a'.repeat(700)
  const parsed = parseCardFile(`${front},short`)
  assert.equal(parsed.cards[0].front.length, 600)
  assert.equal(parsed.cards[0].back, 'short')
})

test('typed answers match after spacing and case changes', () => {
  assert.equal(answersMatch('  Hello   World ', 'hello world'), true)
  assert.equal(answersMatch('hello', 'hello!'), false)
})
