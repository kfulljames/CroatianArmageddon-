import { Home } from './screens/Home.tsx'
import { Setup } from './screens/Setup.tsx'
import { Table } from './screens/Table.tsx'
import { RoundEnd } from './screens/RoundEnd.tsx'
import { GameEnd } from './screens/GameEnd.tsx'
import { Rules } from './screens/Rules.tsx'
import { Scores } from './screens/Scores.tsx'
import { useStore } from './store.ts'

export function App() {
  const screen = useStore((store) => store.screen)
  const game = useStore((store) => store.game)

  return (
    <div className="relative mx-auto flex h-full max-w-md flex-col overflow-hidden">
      {renderScreen()}
    </div>
  )

  function renderScreen() {
    if (screen === 'rules') return <Rules />
    if (screen === 'setup') return <Setup />
    if (!game) return <Home />
    if (screen === 'scores') return <Scores state={game} />
    if (game.phase === 'gameEnd') return <GameEnd state={game} />
    if (game.phase === 'roundEnd') return <RoundEnd state={game} />
    if (screen === 'table') return <Table state={game} />
    return <Home />
  }
}
