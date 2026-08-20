/**
 * Your hand.
 *
 * Two jobs. First, fit: hands run from nine cards up to fifteen or more once
 * penalties land, and all of them must be visible at once, so the cards fan with an
 * overlap computed from the width actually available.
 *
 * Second, arrangement. At a table you sort your hand constantly and nobody plays with
 * the cards in the order they were dealt. You can sort by rank or by suit, put the
 * Ace at whichever end you are building towards, and drag any card — a Joker
 * especially — to sit beside the run you mean it for. Dragging makes the hand yours,
 * and it stays that way until you ask for it to be sorted again.
 *
 * A drag and a tap are told apart by distance, not by timing: move more than a few
 * pixels and you are rearranging, otherwise you are picking a card to play. That
 * avoids a long-press, which is slow, and avoids the two gestures fighting.
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '../../engine/cards.ts'
import { type HandLayout, moveCard, orderHand } from '../handOrder.ts'
import { CardFace } from './CardFace.tsx'

const CARD_WIDTH = 52
/** Enough of a card to still read its rank and suit pip. */
const MIN_VISIBLE = 17
/** How far a finger must travel before this counts as a drag rather than a tap. */
const DRAG_THRESHOLD = 8

export interface HandProps {
  cards: readonly Card[]
  layout: HandLayout
  selectedCardId: string | null
  /** Undefined when it is not your turn — you may still rearrange, just not play. */
  onSelect?: (cardId: string) => void
  onArrange: (orderedCardIds: string[]) => void
}

interface DragState {
  readonly cardId: string
  readonly pointerId: number
  readonly startX: number
  readonly x: number
  readonly targetIndex: number
  /** False until the finger has moved far enough to mean it. */
  readonly active: boolean
}

export function Hand({ cards, layout, selectedCardId, onSelect, onArrange }: HandProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [drag, setDrag] = useState<DragState | null>(null)
  /**
   * Both picking a card and rearranging it resolve on pointer-up, not on click.
   *
   * Capturing the pointer is what makes a drag track reliably across the whole hand,
   * but it also retargets the click that follows to the capturing element — so a
   * click handler on the card itself simply never hears about the tap. Resolving on
   * pointer-up sidesteps that. The click handler is left in place for keyboards,
   * where no pointer-up happens, and ignores anything that follows a pointer.
   */
  const lastPointerActionAt = useRef(0)

  useLayoutEffect(() => {
    const element = frameRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    setWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])

  const ordered = useMemo(() => orderHand(cards, layout), [cards, layout])

  let step = CARD_WIDTH
  if (width > 0 && ordered.length > 1) {
    const needed = CARD_WIDTH * ordered.length
    if (needed > width) {
      step = Math.max(MIN_VISIBLE, (width - CARD_WIDTH) / (ordered.length - 1))
    }
  }

  // While dragging, show the hand as it would look if the card were dropped here.
  const preview = useMemo(() => {
    if (!drag?.active) return ordered
    const without = ordered.filter((card) => card.id !== drag.cardId)
    const moved = ordered.find((card) => card.id === drag.cardId)
    if (!moved) return ordered
    const at = Math.max(0, Math.min(without.length, drag.targetIndex))
    return [...without.slice(0, at), moved, ...without.slice(at)]
  }, [ordered, drag])

  const totalWidth = ordered.length > 0 ? CARD_WIDTH + (ordered.length - 1) * step : 0

  const indexFromPointer = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return 0
    const left = track.getBoundingClientRect().left
    const raw = Math.round((clientX - left - CARD_WIDTH / 2) / step)
    return Math.max(0, Math.min(ordered.length - 1, raw))
  }

  const beginDrag = (event: React.PointerEvent, card: Card, index: number): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    setDrag({
      cardId: card.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      x: event.clientX,
      targetIndex: index,
      active: false,
    })
  }

  const continueDrag = (event: React.PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const active = drag.active || Math.abs(event.clientX - drag.startX) > DRAG_THRESHOLD
    setDrag({
      ...drag,
      x: event.clientX,
      active,
      targetIndex: active ? indexFromPointer(event.clientX) : drag.targetIndex,
    })
  }

  const endDrag = (event: React.PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId) return
    if (drag.active) {
      onArrange(moveCard(ordered, drag.cardId, drag.targetIndex))
    } else {
      onSelect?.(drag.cardId)
    }
    lastPointerActionAt.current = Date.now()
    setDrag(null)
  }

  return (
    <div ref={frameRef} className="w-full overflow-x-auto no-scrollbar px-3">
      <div
        ref={trackRef}
        className="relative mx-auto h-[86px]"
        style={{ width: Math.max(totalWidth, 1) }}
      >
        {ordered.map((card) => {
          const isDragging = drag?.active && drag.cardId === card.id
          const slot = preview.findIndex((other) => other.id === card.id)
          const trackLeft = trackRef.current?.getBoundingClientRect().left ?? 0
          const left = isDragging
            ? Math.max(-CARD_WIDTH / 2, drag.x - trackLeft - CARD_WIDTH / 2)
            : slot * step

          return (
            <div
              key={card.id}
              className="absolute bottom-0"
              style={{
                left,
                zIndex: isDragging ? ordered.length + 2 : card.id === selectedCardId ? ordered.length + 1 : slot,
                touchAction: 'none',
                transition: isDragging ? 'none' : 'left 140ms ease-out',
              }}
              onPointerDown={(event) => beginDrag(event, card, slot)}
              onPointerMove={continueDrag}
              onPointerUp={endDrag}
              onPointerCancel={() => setDrag(null)}
            >
              <CardFace
                card={card}
                size="md"
                selected={card.id === selectedCardId}
                style={isDragging ? { transform: 'translateY(-10px) rotate(2deg)' } : undefined}
                onClick={
                  onSelect
                    ? () => {
                        // Pointer input already resolved on pointer-up; this is here
                        // for keyboard activation only.
                        if (Date.now() - lastPointerActionAt.current < 250) return
                        onSelect(card.id)
                      }
                    : undefined
                }
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
