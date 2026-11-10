import { useRef, useState } from 'react'
import type { FormEvent, PointerEvent } from 'react'
import { readPicture } from '../lib/pictures.ts'

type Face = {
  text: string
  image: string
}

export function CardComposer({
  front,
  back,
  pending,
  submitLabel,
  onFront,
  onBack,
  onSubmit,
  onCancel,
}: {
  front: Face
  back: Face
  pending: boolean
  submitLabel: string
  onFront: (face: Face) => void
  onBack: (face: Face) => void
  onSubmit: (event: FormEvent) => void
  onCancel?: () => void
}) {
  const ready = (front.text.trim().length > 0 || front.image.length > 0)
    && (back.text.trim().length > 0 || back.image.length > 0)

  return (
    <form className="index-card composer" onSubmit={onSubmit}>
      <FaceEditor label="Front" face={front} onChange={onFront} />
      <FaceEditor label="Back" face={back} onChange={onBack} />
      <div className="pair">
        <button type="submit" disabled={pending || !ready}>
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}

function FaceEditor({
  label,
  face,
  onChange,
}: {
  label: string
  face: Face
  onChange: (face: Face) => void
}) {
  const [drawing, setDrawing] = useState(false)
  const [pictureError, setPictureError] = useState<string | null>(null)
  const side = label === 'Back' ? 'back' : 'front'

  async function onFile(file: File | undefined) {
    if (!file) return
    setPictureError(null)
    try {
      onChange({ ...face, image: await readPicture(file) })
    } catch (caught) {
      setPictureError(caught instanceof Error ? caught.message : 'That picture could not be added.')
    }
  }

  return (
    <div className={`composer-face is-${side}`}>
      <p className="card-kicker">{label}</p>
      {face.image ? <img className="card-photo" alt="" src={face.image} /> : null}
      <textarea
        className={side === 'back' ? 'face-back' : 'face-front'}
        value={face.text}
        maxLength={600}
        placeholder={label}
        onChange={(event) => onChange({ ...face, text: event.target.value })}
      />
      <div className="pair media-actions">
        <label className="account-link secondary">
          Photo
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              void onFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
        <button type="button" className="secondary" onClick={() => setDrawing(true)}>
          Draw
        </button>
        {face.image ? (
          <button type="button" className="secondary" onClick={() => onChange({ ...face, image: '' })}>
            Remove
          </button>
        ) : null}
      </div>
      {pictureError ? <p className="error">{pictureError}</p> : null}
      {drawing ? (
        <SketchPad
          onClose={() => setDrawing(false)}
          onSave={(image) => {
            onChange({ ...face, image })
            setDrawing(false)
          }}
        />
      ) : null}
    </div>
  )
}

function SketchPad({ onSave, onClose }: { onSave: (image: string) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const next = point(event)
    if (!canvas || !context || !next) return
    if (!canvas.dataset.ready) {
      context.fillStyle = '#fffaf0'
      context.fillRect(0, 0, canvas.width, canvas.height)
      canvas.dataset.ready = 'yes'
    }
    drawing.current = true
    context.strokeStyle = '#1b2830'
    context.lineWidth = 4
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(next.x, next.y)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const context = canvasRef.current?.getContext('2d')
    const next = point(event)
    if (!context || !next) return
    context.lineTo(next.x, next.y)
    context.stroke()
  }

  function end() {
    drawing.current = false
  }

  return (
    <div className="sketch">
      <canvas
        ref={canvasRef}
        width={640}
        height={400}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="pair">
        <button
          type="button"
          onClick={() => {
            const canvas = canvasRef.current
            if (!canvas) return
            onSave(canvas.toDataURL('image/jpeg', 0.72))
          }}
        >
          Use drawing
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Cancel drawing
        </button>
      </div>
    </div>
  )
}
