import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { CandidatoDrawer } from './components/CandidatoDrawer'
import { useData } from './data/DataContext'
import Painel from './pages/Painel'

const Explorar = lazy(() => import('./pages/Explorar'))
const Mapa = lazy(() => import('./pages/Mapa'))
const Candidatos = lazy(() => import('./pages/Candidatos'))
const Presidente = lazy(() => import('./pages/Presidente'))
const Partidos = lazy(() => import('./pages/Partidos'))
const Metodologia = lazy(() => import('./pages/Metodologia'))

const LINKS = [
  ['/', 'Painel'],
  ['/explorar', 'Explorar'],
  ['/mapa', 'Mapa'],
  ['/presidente', 'Presidente'],
  ['/partidos', 'Partidos'],
  ['/candidatos', 'Candidatos'],
  ['/metodologia', 'Metodologia'],
] as const

type Tema = 'light' | 'dark' | null

function useTema(): [Tema, () => void] {
  const [tema, setTema] = useState<Tema>(() => {
    try {
      return (localStorage.getItem('tema') as Tema) ?? null
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (tema) document.documentElement.dataset.theme = tema
    else delete document.documentElement.dataset.theme
    try {
      if (tema) localStorage.setItem('tema', tema)
      else localStorage.removeItem('tema')
    } catch {
      /* sem armazenamento */
    }
  }, [tema])
  const escuroAtual = () => tema === 'dark' || (!tema && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return [tema, () => setTema(escuroAtual() ? 'light' : 'dark')]
}

export default function App() {
  const { meta } = useData()
  const [, alternarTema] = useTema()
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          <i className="brand-mark" aria-hidden />
          <span>Eleições {meta.ano}</span>
        </NavLink>
        <nav className="nav">
          {LINKS.map(([to, nome]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {nome}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <button className="icon-btn" onClick={alternarTema} title="Alternar tema claro/escuro" aria-label="Alternar tema">
          ◐
        </button>
      </header>
      <main>
        <Suspense fallback={<div className="loading"><div className="spinner" /></div>}>
          <Routes>
            <Route path="/" element={<Painel />} />
            <Route path="/explorar" element={<Explorar />} />
            <Route path="/mapa" element={<Mapa />} />
            <Route path="/presidente" element={<Presidente />} />
            <Route path="/partidos" element={<Partidos />} />
            <Route path="/candidatos" element={<Candidatos />} />
            <Route path="/metodologia" element={<Metodologia />} />
            <Route path="*" element={<Painel />} />
          </Routes>
        </Suspense>
      </main>
      <CandidatoDrawer />
      <footer>
        Fonte: Tribunal Superior Eleitoral (dados abertos, gerados em {meta.geradoEm}) e IBGE. 1º turno em {meta.dataEleicao}; 2º turno em{' '}
        {meta.dataSegundoTurno}. Classificação ideológica é editorial e pode ser ajustada em Metodologia.
      </footer>
    </>
  )
}
