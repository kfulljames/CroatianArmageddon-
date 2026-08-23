/**
 * The table: where the game is actually played.
 *
 * The flow is deliberately one-thing-at-a-time. Tap a card in your hand and every
 * place it can legally go lights up; tap a lit slot to play it there. Nothing that
 * would be illegal is ever offered, so the rules are taught by using the app rather
 * than by reading them.
 */

import { useMemo } from 'react'
import { legalMoves } from '../../engine/actions.ts'
import { cardLabel, handPoints } from '../../engine/cards.ts'
import { findOpenings } from '../../engine/openings.ts'
import { openingSize, roundSpec } from '../../engine/rounds.ts'
import { playerById, topDiscard } from '../../engine/state.ts'
import type { GameState } from '../../engine/state.ts'
import { HUMAN_ID, cardConnects, shouldAskAboutClaim, useStore } from '../store.ts'
import { CardBack, CardFace, CardSlot } from '../components/CardFace.tsx'
import { Hand } from '../components/Hand.tsx'
import { HandControls } from '../components/HandControls.tsx'
import { MeldView } from '../components/MeldView.tsx'
import { Opponents } from '../components/Opponents.tsx'
import { OpeningPicker } from '../components/OpeningPicker.tsx'
import { ClaimPrompt } from '../components/ClaimPrompt.tsx'

export function Table({ state }: { state: GameState }) {
  const dispatch = useStore((store) => store.dispatch)
  const selectedCardId = useStore((store) => store.selectedCardId)
  const selectCard = useStore((store) => store.selectCard)
  const setScreen = useStore((store) => store.setScreen)
  const openingPickerOpen = useStore((store) => store.openingPickerOpen)
  const setOpeningPicker = useStore((store) => store.setOpeningPicker)
  const lastError = useStore((store) => store.lastError)
  const notice = useStore((store) => store.notice)
  const settings = useStore((store) => store.settings)
  const handOrder = useStore((store) => store.handOrder)
  const arrangeHand = useStore((store) => store.arrangeHand)
  const setHandSort = useStore((store) => store.setHandSort)
  const updateSettings = useStore((store) => store.updateSettings)

  const you = playerById(state, HUMAN_ID)
  const spec = roundSpec(state.round)
  const moves = legalMoves(state)
  const yourTurn = moves.playerId === HUMAN_ID && state.phase !== 'claim'
  const discard = topDiscard(state)

  const selectedCard = you.hand.find((card) => card.id === selectedCardId) ?? null

  const kicksForSelected = useMemo(
    () => (selectedCardId ? moves.kicks.filter((kick) => kick.cardId === selectedCardId) : []),
    [moves.kicks, selectedCardId],
  )
  const stealsForSelected = useMemo(
    () => (selectedCardId ? moves.steals.filter((steal) => steal.cardId === selectedCardId) : []),
    [moves.steals, selectedCardId],
  )

  // Only look for openings when the button would be shown; the search is expensive.
  const openingPlans = useMemo(
    () => (yourTurn && moves.canOpen ? findOpenings(you.hand, spec, { limit: 6 }) : []),
    [yourTurn, moves.canOpen, you.hand, spec],
  )

  const handLayout = useMemo(
    () => ({ mode: settings.handSort, aceHigh: settings.aceHigh, customOrder: handOrder }),
    [settings.handSort, settings.aceHigh, handOrder],
  )

  const recentLog = state.log.slice(-2)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-accent">Round {state.round}</span>
            <span className="truncate text-[11px] text-white/50">{spec.label}</span>
          </div>
          <div className="text-[10px] text-white/40">
            {you.hasOpened
              ? 'You are open'
              : `Lay ${openingSize(spec)}: ${requirementText(spec.sets, spec.runs)}`}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <HeaderButton onClick={() => setScreen('scores')}>Scores</HeaderButton>
          <HeaderButton onClick={() => setScreen('rules')}>Rules</HeaderButton>
        </div>
      </header>

      <Opponents state={state} humanId={HUMAN_ID} highlightId={notice?.playerId ?? null} />

      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-2">
        {state.melds.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
            <p className="text-xs text-white/35">Nothing has been laid down yet.</p>
            <p className="max-w-[240px] text-[11px] leading-snug text-white/25">
              Melds appear here as players open. You can add to any of them once you have
              opened yourself.
            </p>
          </div>
        ) : (
          state.melds.map((meld) => {
            const kicks = kicksForSelected.filter((kick) => kick.meldId === meld.id)
            const steals = stealsForSelected.filter((steal) => steal.meldId === meld.id)
            return (
              <MeldView
                key={meld.id}
                meld={meld}
                ownerName={playerById(state, meld.ownerId).name}
                isYours={meld.ownerId === HUMAN_ID}
                kickable={kicks.length > 0}
                kickPositions={kicks.map((kick) => kick.position)}
                stealableIndexes={steals.map((steal) => steal.index)}
                onKick={(position) =>
                  selectedCardId &&
                  dispatch({ type: 'kick', cardId: selectedCardId, meldId: meld.id, position })
                }
                onSteal={(index) =>
                  selectedCardId &&
                  dispatch({ type: 'stealJoker', meldId: meld.id, index, cardId: selectedCardId })
                }
              />
            )
          })
        )}
      </div>

      <div className="flex items-center justify-center gap-6 border-t border-white/10 px-3 py-2">
        <PileColumn
          label={`Draw (${state.drawPile.length})`}
          hint={state.drawPileKnown ? 'flipped' : undefined}
        >
          {state.drawPile.length > 0 ? <CardBack size="md" /> : <CardSlot size="md">empty</CardSlot>}
          {yourTurn && state.phase === 'draw' && moves.canDrawFromPile && (
            <PileButton onClick={() => dispatch({ type: 'drawFromPile' })}>Draw</PileButton>
          )}
        </PileColumn>

        <PileColumn
          label="Discard"
          hint={
            discard && !moves.canTakeDiscard && state.phase === 'draw' ? 'claimed away' : undefined
          }
        >
          {discard ? <CardFace card={discard} size="md" /> : <CardSlot size="md">empty</CardSlot>}
          {yourTurn && state.phase === 'draw' && moves.canTakeDiscard && (
            <PileButton onClick={() => dispatch({ type: 'takeDiscard' })}>Take</PileButton>
          )}
        </PileColumn>
      </div>

      <div className="border-t border-white/10 bg-black/25">
        {/*
          Somebody taking the discard is the one thing that happens *to* you while it
          is not your turn, so it gets said plainly and held on screen, rather than
          scrolling past in the log at ten pixels tall.
        */}
        {notice ? (
          <div className="px-3 pt-2">
            <p className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-center text-xs font-medium text-accent-soft">
              {notice.text}
            </p>
          </div>
        ) : (
          <div className="px-3 pt-1.5 text-[11px] leading-tight text-white/45">
            {recentLog.map((entry, index) => (
              <div key={`${entry.turn}-${index}`} className="truncate">
                {entry.text}
              </div>
            ))}
          </div>
        )}

        {lastError && (
          <div className="mx-3 mt-1 rounded bg-red-500/20 px-2 py-1 text-[11px] text-red-200">
            {lastError}
          </div>
        )}

        <div className="pb-1 pt-2">
          <HandControls
            mode={settings.handSort}
            aceHigh={settings.aceHigh}
            onSort={setHandSort}
            onAceHigh={(aceHigh) => updateSettings({ aceHigh })}
          />
          <Hand
            cards={you.hand}
            layout={handLayout}
            selectedCardId={selectedCardId}
            onArrange={arrangeHand}
            onSelect={
              yourTurn && state.phase === 'play'
                ? (cardId) => selectCard(cardId === selectedCardId ? null : cardId)
                : undefined
            }
          />
        </div>

        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-1">
          <span className="text-[10px] text-white/40">
            {you.hand.length} cards · {handPoints(you.hand)} pts
          </span>

          <div className="flex gap-2">
            {yourTurn && state.phase === 'play' && moves.canOpen && (
              <ActionButton variant="accent" onClick={() => setOpeningPicker(true)}>
                Open
              </ActionButton>
            )}
            {yourTurn && state.phase === 'play' && selectedCard && (
              <ActionButton
                onClick={() => dispatch({ type: 'discard', cardId: selectedCard.id })}
              >
                Discard {cardLabel(selectedCard)}
              </ActionButton>
            )}
          </div>
        </div>

        <TurnHint state={state} yourTurn={yourTurn} hasSelection={selectedCard != null} />
      </div>

      {openingPickerOpen && (
        <OpeningPicker
          plans={openingPlans}
          onCancel={() => setOpeningPicker(false)}
          onChoose={(plan) => dispatch({ type: 'open', proposals: plan.proposals })}
        />
      )}

      {discard && shouldAskAboutClaim(state) && (
        <ClaimPrompt
          card={discard}
          costsPenalty={moves.claimCostsPenalty}
          connects={cardConnects(state, HUMAN_ID, discard)}
          onRespond={(want) => dispatch({ type: 'claimResponse', want })}
        />
      )}
    </div>
  )
}

function requirementText(sets: number, runs: number): string {
  const parts: string[] = []
  if (sets > 0) parts.push(`${sets} × three of a kind`)
  if (runs > 0) parts.push(`${runs} × run of four`)
  return parts.join(' + ')
}

function TurnHint({
  state,
  yourTurn,
  hasSelection,
}: {
  state: GameState
  yourTurn: boolean
  hasSelection: boolean
}) {
  let text: string
  if (state.phase === 'claim') {
    const decidingId = state.claim?.order[state.claim.index]
    const deciding = state.players.find((player) => player.id === decidingId)
    text = deciding
      ? `${deciding.name} is deciding whether to take the discard…`
      : 'Someone is deciding whether to take the discard…'
  } else if (!yourTurn) {
    text = `${state.players[state.turnIndex]?.name ?? 'Someone'} is playing…`
  } else if (state.phase === 'draw') {
    text = 'Start your turn by taking a card.'
  } else if (hasSelection) {
    text = 'Tap a lit slot to play it, or discard to end your turn.'
  } else {
    text = 'Tap a card to play it.'
  }

  return (
    <p className="border-t border-white/5 px-3 py-1.5 text-center text-[11px] text-white/45">
      {text}
    </p>
  )
}

function PileColumn({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-col items-center">{children}</div>
      <span className="text-[10px] text-white/45">{label}</span>
      {hint && <span className="text-[9px] text-accent/70">{hint}</span>}
    </div>
  )
}

function PileButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 rounded bg-accent px-2 py-0.5 text-[11px] font-semibold text-felt-900 active:scale-95"
    >
      {children}
    </button>
  )
}

function HeaderButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-white/15 px-2 py-1 text-[11px] text-white/70 active:scale-95"
    >
      {children}
    </button>
  )
}

function ActionButton({
  onClick,
  children,
  variant = 'plain',
}: {
  onClick: () => void
  children: React.ReactNode
  variant?: 'plain' | 'accent'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md px-3 py-1.5 text-xs font-semibold active:scale-95',
        variant === 'accent'
          ? 'bg-accent text-felt-900'
          : 'border border-white/20 bg-white/10 text-white',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
