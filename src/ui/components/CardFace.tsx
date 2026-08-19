/**
 * A single playing card.
 *
 * Readability beats realism here. Someone holding twelve cards on a phone is
 * scanning for ranks and suits, so the rank is set large and the suit pip sits right
 * beside it — both survive being overlapped down to a sliver of the card's width.
 */

import type { CSSProperties } from 'react'
import { type Card, SUIT_SYMBOL, rankLabel } from '../../engine/cards.ts'

export type CardSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<CardSize, { width: number; height: number; rank: number; pip: number }> = {
  xs: { width: 30, height: 42, rank: 13, pip: 11 },
  sm: { width: 38, height: 54, rank: 16, pip: 13 },
  md: { width: 52, height: 74, rank: 22, pip: 18 },
  lg: { width: 64, height: 90, rank: 27, pip: 22 },
}

export interface CardFaceProps {
  card: Card
  size?: CardSize
  selected?: boolean
  dimmed?: boolean
  highlighted?: boolean
  onClick?: () => void
  style?: CSSProperties
  label?: string
}

export function CardFace({
  card,
  size = 'md',
  selected = false,
  dimmed = false,
  highlighted = false,
  onClick,
  style,
  label,
}: CardFaceProps) {
  const metrics = SIZES[size]
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
  const interactive = onClick != null

  // A card that cannot be tapped is not a control, and rendering it as one would
  // nest buttons inside the opening picker's own buttons — invalid, and it breaks
  // keyboard and screen-reader navigation.
  const Element = interactive ? 'button' : 'div'

  return (
    <Element
      {...(interactive ? { type: 'button' as const, onClick } : {})}
      aria-label={label ?? (card.isJoker ? 'Joker' : `${rankLabel(card.rank!)} of ${card.suit}`)}
      className={[
        'relative shrink-0 rounded-[6px] border bg-card-face shadow-card transition-all duration-150',
        'flex flex-col items-center justify-center select-none',
        interactive ? 'cursor-pointer active:scale-95' : 'cursor-default',
        selected ? '-translate-y-3 ring-2 ring-accent shadow-lift' : '',
        highlighted ? 'ring-2 ring-emerald-300' : '',
        dimmed ? 'opacity-40' : '',
        card.isJoker ? 'border-accent' : 'border-card-edge',
      ].join(' ')}
      style={{ width: metrics.width, height: metrics.height, ...style }}
    >
      {card.isJoker ? (
        <span
          className="font-black tracking-tight text-purple-700"
          style={{ fontSize: metrics.pip }}
        >
          JKR
        </span>
      ) : (
        <span
          className={`flex flex-col items-center leading-none ${isRed ? 'text-red-600' : 'text-neutral-900'}`}
        >
          <span className="font-bold" style={{ fontSize: metrics.rank }}>
            {rankLabel(card.rank!)}
          </span>
          <span style={{ fontSize: metrics.pip }}>{SUIT_SYMBOL[card.suit!]}</span>
        </span>
      )}
    </Element>
  )
}

/** The back of a card, for the draw pile. */
export function CardBack({ size = 'lg' }: { size?: CardSize }) {
  const metrics = SIZES[size]
  return (
    <div
      className="shrink-0 rounded-[6px] border border-emerald-900/60 shadow-card"
      style={{
        width: metrics.width,
        height: metrics.height,
        background:
          'repeating-linear-gradient(45deg, #14382a 0 6px, #1b4534 6px 12px)',
      }}
    />
  )
}

/** An empty pile slot. */
export function CardSlot({ size = 'lg', children }: { size?: CardSize; children?: React.ReactNode }) {
  const metrics = SIZES[size]
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-[6px] border border-dashed border-white/20 text-[10px] text-white/40"
      style={{ width: metrics.width, height: metrics.height }}
    >
      {children}
    </div>
  )
}
