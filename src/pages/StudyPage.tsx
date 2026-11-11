import { useEffect, useRef, useState, type TransitionEvent } from 'react'
import { useParams } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase.ts'
import { explain } from '../lib/errors.ts'
import { answersMatch } from '../lib/cardFile.ts'
import { loadDailyPile } from '../lib/daily.ts'
import { getExampleDeck, isExampleDeckId } from '../lib/examples.ts'
import { getGuestDeck, isGuestDeckId, subscribeGuestDecks } from '../lib/guestDecks.ts'
import { isStudyQuiet, setStudyQuiet, subscribeStudyQuiet } from '../lib/quiet.ts'
import { marksForCards, removeProgress, saveProgress, type ProgressMark, type Rating } from '../lib/progress.ts'
import { shuffle } from '../lib/shuffle.ts'
import { useAuth } from '../useAuth.ts'
import type { CardRecord, Orientation, Visibility } from '../types.ts'

function StudyFace({
  side,
  rear,
  orientation,
  text,
  image,
}: {
  side: 'front' | 'back'
  rear: boolean
  orientation: Orientation
  text: string
  image: string
}) {
  return (
    <span className={`flip-face${rear ? ' is-rear' : ''}`}>
      <span className={`study-card is-${orientation} is-${side}`}>
        <span className="card-kicker">{side === 'front' ? 'Front' : 'Back'}</span>
        {image ? <img className="card-photo" alt="" src={image} /> : null}
        <span className={`study-text${side === 'front' ? ' face-front' : ''}`}>{text}</span>
      </span>
    </span>
  )
}

export function StudyPage({ daily = false }: { daily?: boolean }) {
  const params = useParams()
  const deckId = daily ? 'daily' : (params.deckId ?? '')
  const { user } = useAuth()
  const guest = !daily && isGuestDeckId(deckId)
  const example = !daily && isExampleDeckId(deckId)
  const [title, setTitle] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [orientation, setOrientation] = useState<Orientation>('vertical')
  const [ownerId, setOwnerId] = useState('')
  const [cards, setCards] = useState<CardRecord[]>([])
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [queue, setQueue] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [turning, setTurning] = useState(false)
  const [backFirst, setBackFirst] = useState(false)
  const turningRef = useRef(false)
  const [revealed, setRevealed] = useState(false)
  const [ratings, setRatings] = useState<Record<string, Rating>>({})
  const [roundIds, setRoundIds] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [missedStart, setMissedStart] = useState(false)
  const [typeCheck, setTypeCheck] = useState(() => localStorage.getItem('deck-type-check') === 'on')
  const [typed, setTyped] = useState('')
  const [verdict, setVerdict] = useState<'match' | 'miss' | null>(null)
  const [copied, setCopied] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [quiet, setQuiet] = useState(isStudyQuiet())
  const [fullscreen, setFullscreen] = useState(false)
  const [undo, setUndo] = useState<{
    cardId: string
    index: number
    previous: ProgressMark | null
    ratings: Record<string, Rating>
    done: boolean
  } | null>(null)
  const [sessionDeck, setSessionDeck] = useState<string | null>(null)
  const [sources, setSources] = useState<Record<string, { deckId: string; deckTitle: string }>>({})
  const started = useRef(false)
  const memoryApplied = useRef('')
  const lastMarks = useRef<Record<string, ProgressMark>>({})

  if (sessionDeck !== deckId) {
    setSessionDeck(deckId)
    setOwnerId('')
    setIndex(0)
    setFlipped(false)
    setTurning(false)
    turningRef.current = false
    setRevealed(false)
    setRatings({})
    setDone(false)
    setMissedStart(false)
    setTyped('')
    setVerdict(null)
    setUndo(null)
    memoryApplied.current = ''
    const found = example ? getExampleDeck(deckId) : null
    if (found) {
      const next = found.cards.map((card, index) => ({
        id: `${found.id}-${index}`,
        ownerId: '',
        visibility: 'public' as const,
        front: card.front,
        back: card.back,
        frontImage: card.frontImage || '',
        backImage: card.backImage || '',
        order: index,
      }))
      const order = shuffle(next.map((card) => card.id))
      setTitle(found.title)
      setVisibility('public')
      setOrientation('vertical')
      setMessage(null)
      setCards(next)
      setQueue(order)
      setRoundIds(order)
      setReady(true)
    } else if (example) {
      setTitle('')
      setMessage('This deck does not exist.')
      setCards([])
      setQueue([])
      setRoundIds([])
      setReady(true)
    } else {
      setTitle('')
      setMessage(null)
      setCards([])
      setQueue([])
      setRoundIds([])
      setReady(false)
    }
  }

  function begin(ids: string[], keepRatings: boolean) {
    const order = shuffle(ids)
    setQueue(order)
    setRoundIds(order)
    setIndex(0)
    setFlipped(false)
    setTurning(false)
    turningRef.current = false
    setRevealed(false)
    setTyped('')
    setVerdict(null)
    setDone(order.length === 0)
    if (!keepRatings) setRatings({})
  }

  function takeCards(next: CardRecord[]) {
    setCards(next)
    if (!started.current && next.length > 0) {
      started.current = true
      begin(next.map((card) => card.id), false)
    }
  }

  useEffect(() => {
    started.current = false
  }, [deckId])

  useEffect(() => {
    if (!guest || daily) return
    const pull = () => {
      const found = getGuestDeck(deckId)
      if (!found) {
        setMessage('This deck no longer exists.')
        setCards([])
        setReady(true)
        return
      }
      setTitle(found.title)
      setVisibility(found.visibility)
      setOwnerId('')
      setOrientation(found.orientation === 'horizontal' ? 'horizontal' : 'vertical')
      setMessage(null)
      takeCards(
        found.cards
          .map((card) => ({
            id: card.id,
            ownerId: '',
            visibility: found.visibility,
            front: card.front,
            back: card.back,
            frontImage: card.frontImage || '',
            backImage: card.backImage || '',
            order: card.order,
          }))
          .sort((a, b) => a.order - b.order),
      )
      setReady(true)
    }
    pull()
    return subscribeGuestDecks(pull)
  }, [deckId, guest, daily])

  useEffect(() => {
    if (!daily) return
    let cancelled = false
    setTitle('Today')
    void loadDailyPile(user?.uid ?? null)
      .then((pile) => {
        if (cancelled) return
        const sourceMap: Record<string, { deckId: string; deckTitle: string }> = {}
        const next = pile.map((card, index) => {
          sourceMap[card.id] = { deckId: card.deckId, deckTitle: card.deckTitle }
          return {
            id: card.id,
            ownerId: '',
            visibility: 'private' as const,
            front: card.front,
            back: card.back,
            frontImage: card.frontImage,
            backImage: card.backImage,
            order: index,
          }
        })
        setSources(sourceMap)
        setCards(next)
        setMessage(null)
        begin(next.map((card) => card.id), false)
        setReady(true)
      })
      .catch((caught) => {
        if (cancelled) return
        setMessage(explain(caught))
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [daily, user])

  useEffect(() => {
    if (guest || example || daily) return
    return onSnapshot(
      doc(db, 'decks', deckId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setMessage('This deck does not exist.')
          setReady(true)
          return
        }
        const data = snapshot.data()
        setTitle(String(data.title ?? 'Deck'))
        setVisibility(data.visibility === 'public' ? 'public' : 'private')
        setOwnerId(String(data.ownerId ?? ''))
        setOrientation(data.orientation === 'horizontal' ? 'horizontal' : 'vertical')
        setMessage(null)
        setReady(true)
      },
      (caught) => {
        setReady(true)
        setMessage(
          caught instanceof FirebaseError && caught.code === 'permission-denied'
            ? 'This deck is private.'
            : explain(caught),
        )
      },
    )
  }, [deckId, example, guest, daily])

  useEffect(() => {
    if (guest || example || daily || !ready || message) return
    const mine = user && user.uid === ownerId
    const cardsQuery = mine
      ? query(collection(db, 'decks', deckId, 'cards'), where('ownerId', '==', user.uid))
      : query(collection(db, 'decks', deckId, 'cards'), where('visibility', '==', 'public'))
    return onSnapshot(
      cardsQuery,
      (snapshot) => {
        const next = snapshot.docs.map((item) => {
          const data = item.data()
          return {
            id: item.id,
            ref: item.ref,
            ownerId: String(data.ownerId ?? ''),
            visibility: (data.visibility === 'public' ? 'public' : 'private') as Visibility,
            front: String(data.front ?? ''),
            back: String(data.back ?? ''),
            frontImage: String(data.frontImage ?? ''),
            backImage: String(data.backImage ?? ''),
            order: Number(data.order ?? 0),
          }
        })
        next.sort((a, b) => a.order - b.order)
        takeCards(next)
      },
      (caught) => setMessage(explain(caught)),
    )
  }, [deckId, example, guest, daily, message, ownerId, ready, user])

  useEffect(() => {
    if (daily || !ready || cards.length === 0 || message) return
    const memoryKey = `${deckId}:${user?.uid ?? ''}`
    if (memoryApplied.current === memoryKey) return
    const snapshot = cards
    let cancelled = false
    void marksForCards(
      user?.uid ?? null,
      snapshot.map((item) => item.id),
    ).then((marks) => {
      if (cancelled) return
      memoryApplied.current = memoryKey
      lastMarks.current = { ...lastMarks.current, ...marks }
      const missed = snapshot.filter((item) => marks[item.id]?.rating === 'again').map((item) => item.id)
      if (missed.length > 0) {
        setMissedStart(true)
        begin(missed, false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [daily, ready, deckId, message, cards.length, user])

  useEffect(() => subscribeStudyQuiet(() => setQuiet(isStudyQuiet())), [])

  useEffect(() => {
    function onFullscreen() {
      setFullscreen(document.fullscreenElement != null)
    }
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen)
      setStudyQuiet(false)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    }
  }, [])

  async function toggleFullscreenStudy() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        setStudyQuiet(false)
        return
      }
      await document.documentElement.requestFullscreen()
      setStudyQuiet(true)
    } catch {
      setFullscreen(document.fullscreenElement != null)
    }
  }

  function showCard(cardId: string) {
    return cards.find((card) => card.id === cardId)
  }

  function rate(value: Rating) {
    const cardId = queue[index]
    const current = cards.find((item) => item.id === cardId)
    if (!cardId || !current) return
    const source = sources[cardId]
    const mark: ProgressMark = {
      cardId,
      deckId: source?.deckId || deckId,
      deckTitle: source?.deckTitle || title,
      rating: value,
      seenAt: Date.now(),
      front: current.front,
      back: current.back,
      frontImage: current.frontImage,
      backImage: current.backImage,
    }
    setUndo({
      cardId,
      index,
      previous: lastMarks.current[cardId] ?? null,
      ratings,
      done,
    })
    lastMarks.current[cardId] = mark
    void saveProgress(user?.uid ?? null, mark).catch((caught) => setSaveError(explain(caught)))
    const nextRatings = { ...ratings, [cardId]: value }
    setRatings(nextRatings)
    setTyped('')
    setVerdict(null)
    if (index + 1 >= queue.length) {
      setDone(true)
      return
    }
    setIndex(index + 1)
    setFlipped(false)
    setTurning(false)
    turningRef.current = false
    setRevealed(false)
  }

  function undoMark() {
    if (!undo) return
    setIndex(undo.index)
    setRatings(undo.ratings)
    setDone(undo.done)
    setRevealed(false)
    setFlipped(false)
    setTurning(false)
    turningRef.current = false
    setTyped('')
    setVerdict(null)
    if (undo.previous) {
      lastMarks.current[undo.cardId] = undo.previous
      void saveProgress(user?.uid ?? null, undo.previous).catch((caught) => setSaveError(explain(caught)))
    } else {
      delete lastMarks.current[undo.cardId]
      void removeProgress(user?.uid ?? null, undo.cardId)
    }
    setUndo(null)
  }

  function chooseDirection(nextBackFirst: boolean) {
    setBackFirst(nextBackFirst)
    setFlipped(false)
    setTurning(false)
    turningRef.current = false
    setRevealed(false)
  }

  function flipCard() {
    if (turningRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFlipped((current) => !current)
      setRevealed(true)
      return
    }
    turningRef.current = true
    setTurning(true)
    setRevealed(true)
  }

  function finishTurn(event: TransitionEvent<HTMLSpanElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
    if (!turningRef.current) return
    turningRef.current = false
    setTurning(false)
    setFlipped((current) => !current)
  }

  function chooseTyping(next: boolean) {
    setTypeCheck(next)
    localStorage.setItem('deck-type-check', next ? 'on' : 'off')
  }

  function checkTyped() {
    if (!card) return
    const expected = backFirst === flipped ? card.back : card.front
    setVerdict(answersMatch(typed, expected) ? 'match' : 'miss')
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/study/${deckId}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const area = document.createElement('textarea')
      area.value = url
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select')) return
      if (done || !card) return
      if (event.key === ' ' || event.code === 'Space') {
        if (target instanceof HTMLElement && target.closest('button, a')) return
        event.preventDefault()
        flipCard()
        return
      }
      if (!revealed) return
      if (event.key === '1') rate('got')
      if (event.key === '2') rate('unsure')
      if (event.key === '3') rate('again')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function count(value: Rating) {
    return roundIds.filter((id) => ratings[id] === value).length
  }

  const card = showCard(queue[index] ?? '')
  const againIds = roundIds.filter((id) => ratings[id] !== 'got' && showCard(id))

  return (
    <main className="study-screen">
      <div className="study-mode-row">
        <button type="button" className="secondary" onClick={() => setStudyQuiet(!quiet)}>
          {quiet ? 'Exit study mode' : 'Study mode'}
        </button>
        <button type="button" className="secondary" onClick={() => void toggleFullscreenStudy()}>
          {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </button>
      </div>
      {message ? (
        <>
          <h1>Study</h1>
          <p className="status">{message}</p>
        </>
      ) : null}
      {!message && ready && cards.length === 0 ? (
        <>
          <h1>{daily ? 'Today' : title || 'Study'}</h1>
          <p className="status">
            {daily ? 'Nothing is waiting today.' : 'This deck has no cards yet.'}
          </p>
        </>
      ) : null}
      {!message && done ? (
        <div className="study-done">
          <p className="eyebrow">Finished</p>
          <h1>{title}</h1>
          <p className="lede">
            Got it {count('got')} · Skip {count('unsure')} · Don't know {count('again')}
          </p>
          {againIds.length > 0 ? (
            <button type="button" onClick={() => begin(againIds, true)}>
              Study again without cards you got
            </button>
          ) : (
            <p className="status">Every card in this pass was marked Got it.</p>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => begin(cards.map((item) => item.id), false)}
          >
            Study every card again
          </button>
          <p className="status">
            Got it, Skip, and Don't know are saved. The next time you open this deck, it starts
            with the cards you marked Don't know.
          </p>
          {undo ? (
            <button type="button" className="secondary" onClick={undoMark}>
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
      {!message && !done && card ? (
        <>
          <p className="status">
            {daily ? 'Today' : title} · {index + 1} of {queue.length}
          </p>
          {daily && sources[card.id]?.deckTitle ? (
            <p className="status">{sources[card.id].deckTitle}</p>
          ) : null}
          {missedStart ? (
            <p className="status">
              Starting with cards you marked Don't know.{' '}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setMissedStart(false)
                  begin(cards.map((item) => item.id), false)
                }}
              >
                Study the whole deck
              </button>
            </p>
          ) : null}
          <div className={`study-stage is-${orientation}`}>
          <div className={`flip-scene is-${orientation}`}>
          <button
            type="button"
            className="flip-card"
            aria-label={`${backFirst === flipped ? 'Front' : 'Back'} of the card. Click to flip.`}
            onClick={flipCard}
          >
            <span
              key={`${card.id}-${backFirst ? 'back' : 'front'}-${flipped ? 'flipped' : 'start'}`}
              className={`flip-inner${turning ? ' is-turning' : ''}`}
              onTransitionEnd={finishTurn}
            >
              {backFirst === flipped ? (
                <StudyFace side="front" rear={false} orientation={orientation} text={card.front} image={card.frontImage} />
              ) : (
                <StudyFace side="back" rear={false} orientation={orientation} text={card.back} image={card.backImage} />
              )}
              {turning ? (
                backFirst === flipped ? (
                  <StudyFace side="back" rear orientation={orientation} text={card.back} image={card.backImage} />
                ) : (
                  <StudyFace side="front" rear orientation={orientation} text={card.front} image={card.frontImage} />
                )
              ) : null}
            </span>
          </button>
          </div>
          {typeCheck ? (
            hiddenText(card, backFirst, flipped) ? (
              <form
                className="answer-box"
                onSubmit={(event) => {
                  event.preventDefault()
                  checkTyped()
                }}
              >
                <label>
                  <span className="option-label">Your answer</span>
                  <input
                    value={typed}
                    onChange={(event) => {
                      setTyped(event.target.value)
                      setVerdict(null)
                    }}
                  />
                </label>
                <button type="submit" className="secondary">
                  Check
                </button>
                {verdict === 'match' ? <p className="saved">That matches.</p> : null}
                {verdict === 'miss' ? <p className="status">Not quite. Flip the card to see it.</p> : null}
              </form>
            ) : (
              <p className="status">This side is a picture. Flip the card to see it.</p>
            )
          ) : null}
          {revealed ? (
            <div className="rate-row">
              <button type="button" className="rate-got" onClick={() => rate('got')}>
                Got it
              </button>
              <button type="button" className="rate-unsure" onClick={() => rate('unsure')}>
                Skip
              </button>
              <button type="button" className="rate-again" onClick={() => rate('again')}>
                Don't know
              </button>
            </div>
          ) : null}
          </div>
          {undo ? (
            <button type="button" className="secondary" onClick={undoMark}>
              Undo
            </button>
          ) : null}
          <div className="study-direction">
            <p className="option-label">Type the answer:</p>
            <div className="pair equal-pair">
              <button type="button" className={typeCheck ? '' : 'secondary'} onClick={() => chooseTyping(true)}>
                On
              </button>
              <button type="button" className={typeCheck ? 'secondary' : ''} onClick={() => chooseTyping(false)}>
                Off
              </button>
            </div>
          </div>
          <div className="study-direction">
            <p className="option-label">Study direction:</p>
            <div className="pair equal-pair">
              <button
                type="button"
                className={backFirst ? 'secondary' : ''}
                onClick={() => chooseDirection(false)}
              >
                Front first
              </button>
              <button
                type="button"
                className={backFirst ? '' : 'secondary'}
                onClick={() => chooseDirection(true)}
              >
                Back first
              </button>
            </div>
          </div>
          {saveError ? <p className="error">{saveError}</p> : null}
          <p className="status">Space flips the card. After it is open, 1 is Got it, 2 is Skip, and 3 is Don't know.</p>
          {visibility === 'public' ? (
            <button type="button" className="secondary" onClick={copyShareLink}>
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          ) : null}
        </>
      ) : null}
    </main>
  )
}

function hiddenText(card: CardRecord, backFirst: boolean, flipped: boolean) {
  return backFirst === flipped ? card.back : card.front
}
