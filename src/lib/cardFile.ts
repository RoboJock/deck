export type ImportedCard = {
  front: string
  back: string
}

function splitRow(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (char === delimiter && !quoted) {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }
  cells.push(current)
  return cells
}

export function parseCardFile(text: string): { cards: ImportedCard[]; skipped: number } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const cards: ImportedCard[] = []
  let skipped = 0
  let headerPending = true
  for (const line of lines) {
    if (!line.trim()) continue
    const delimiter = line.includes('\t') && !line.includes(',') ? '\t' : ','
    const cells = splitRow(line, delimiter).map((cell) => cell.trim())
    if (
      headerPending &&
      /^front$/i.test(cells[0] ?? '') &&
      /^back$/i.test(cells[1] ?? '')
    ) {
      headerPending = false
      continue
    }
    headerPending = false
    const front = (cells[0] ?? '').slice(0, 600)
    const back = (cells[1] ?? '').slice(0, 600)
    if (!front || !back) {
      skipped += 1
      continue
    }
    cards.push({ front, back })
  }
  return { cards, skipped }
}

export function answersMatch(typed: string, expected: string) {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
  return normalize(typed) === normalize(expected)
}
