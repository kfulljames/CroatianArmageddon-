/**
 * Your hand.
 *
 * Hands run from nine cards up to fifteen or more once penalties start landing, and
 * all of them have to be visible at once on a phone — scrolling to find a card you
 * already know you have is miserable. So the cards fan with an overlap computed from
 * the actual width available, which keeps every rank and suit pip showing no matter
 * how many you are holding. The selected card lifts clear of its neighbours.
 */

import { useLayoutEffect, useRef, useState } from 'react'
import type { Card } from '../../engine/cards.ts'
import { CardFace } from './CardFace.tsx'

const CARD_WIDTH = 52
/** Enough of a card to still read its rank and suit. */
const MIN_VISIBLE = 17

export interface HandProps {
  cards: readonly Card[]
  selectedCardId: string | null
  onSelect?: (cardId: string) => void
}

export function Hand({ cards, selectedCardId, onSelect }: HandProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    setWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])

  // How far each card sits from the one before it.
  let step = CARD_WIDTH
  if (width > 0 && cards.length > 1) {
    const needed = CARD_WIDTH + (cards.length - 1) * CARD_WIDTH
    if (needed > width) {
      step = Math.max(MIN_VISIBLE, (width - CARD_WIDTH) / (cards.length - 1))
    }
  }

  const totalWidth = cards.length > 0 ? CARD_WIDTH + (cards.length - 1) * step : 0

  return (
    <div ref={containerRef} className="w-full overflow-x-auto no-scrollbar px-3">
      <div className="relative mx-auto h-[86px]" style={{ width: Math.max(totalWidth, 1) }}>
        {cards.map((card, index) => {
          const selected = card.id === selectedCardId
          return (
            <div
              key={card.id}
              className="absolute bottom-0"
              style={{ left: index * step, zIndex: selected ? cards.length + 1 : index }}
            >
              <CardFace
                card={card}
                size="md"
                selected={selected}
                onClick={onSelect ? () => onSelect(card.id) : undefined}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
