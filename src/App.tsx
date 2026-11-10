import { CalendarPage } from '@/pages/CalendarPage'
import { fi } from '@/i18n/fi'

function App() {
  return (
    <div className="min-h-screen bg-cream-50">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-soft bg-lavender-300" aria-hidden />
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              {fi.app.title}
            </h1>
          </div>
        </div>
      </header>
      <main>
        <CalendarPage />
      </main>
    </div>
  )
}

export default App
