import { useEffect, useId, useRef } from 'react'
import {
  AlertTriangle,
  Clock,
  Compass,
  Globe,
  MapPin,
  Radio,
  Sun,
  X,
} from 'lucide-react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { GuidePanelProps } from './types'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function GuidePanel({ open, onClose }: GuidePanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const focusFrameRef = useRef<number | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (open) {
      if (!previousFocusRef.current && document.activeElement instanceof HTMLElement) {
        previousFocusRef.current = document.activeElement
      }
      focusFrameRef.current = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
      return () => {
        if (focusFrameRef.current !== null) {
          window.cancelAnimationFrame(focusFrameRef.current)
          focusFrameRef.current = null
        }
      }
    }

    if (previousFocusRef.current?.isConnected) {
      previousFocusRef.current.focus()
    }
    previousFocusRef.current = null
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((element) => element.getClientRects().length > 0)
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (!dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [open, onClose])

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab' && event.target === dialogRef.current) {
      event.preventDefault()
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    }
  }

  if (!open) return null

  return (
    <div
      className="insights-guide-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="insights-root insights-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="insights-guide-header">
          <div>
            <p className="insights-eyebrow">Lunar Landing Site Navigator</p>
            <h2 className="insights-panel-title" id={titleId}>Guía de uso y datos</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="insights-guide-close"
            type="button"
            onClick={onClose}
            aria-label="Cerrar guía"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="insights-guide-body">
          <section className="insights-guide-section">
            <h3><MapPin size={16} aria-hidden="true" /> Sitios y fechas</h3>
            <p>Elige sitios del catálogo o introduce coordenadas y define el periodo que quieres comparar.</p>
          </section>

          <section className="insights-guide-section">
            <h3><Sun size={16} aria-hidden="true" /> Iniciar el análisis</h3>
            <p>Cuando hayas definido los sitios y las fechas, inicia el análisis para calcular las condiciones de cada alternativa.</p>
          </section>

          <section className="insights-guide-section">
            <h3><Compass size={16} aria-hidden="true" /> Puntos y colores del visor</h3>
            <p>Los marcadores representan sitios o cuerpos celestes. Los colores identifican la condición, acompañados por sus etiquetas:</p>
            <ul className="insights-guide-legend">
              <li><i className="insights-guide-swatch insights-guide-swatch--sun" /> Ámbar: Sol.</li>
              <li><i className="insights-guide-swatch insights-guide-swatch--earth" /> Cian: Tierra.</li>
              <li><i className="insights-guide-swatch insights-guide-swatch--both" /> Verde: condiciones simultáneas.</li>
            </ul>
          </section>

          <section className="insights-guide-section">
            <h3><Compass size={16} aria-hidden="true" /> Azimut y elevación</h3>
            <p>El azimut es la dirección: norte 0°, este 90°, sur 180° y oeste 270°. La elevación mide el ángulo respecto al horizonte: 0° está en el horizonte, valores positivos quedan arriba y negativos abajo.</p>
          </section>

          <section className="insights-guide-section">
            <h3><Clock size={16} aria-hidden="true" /> Ventana simultánea</h3>
            <p>Es el tramo continuo en el que el Sol y la Tierra son visibles a la vez. No es lo mismo que el porcentaje acumulado durante todo el periodo.</p>
          </section>

          <section className="insights-guide-section">
            <h3><Globe size={16} aria-hidden="true" /> Fuentes de datos NASA</h3>
            <p>JPL Horizons aporta posiciones del Sol y la Tierra; Moon Trek, cartografía; LOLA/PDS y PGDA, datos de elevación del terreno.</p>
          </section>

          <section className="insights-guide-section">
            <h3><Radio size={16} aria-hidden="true" /> Visibilidad no es comunicación</h3>
            <p>La visibilidad geométrica indica una línea de visión según el modelo. No garantiza una comunicación real, que depende también del equipo, la señal y otros obstáculos.</p>
          </section>

          <section className="insights-guide-section">
            <h3><AlertTriangle size={16} aria-hidden="true" /> Condiciones y seguridad</h3>
            <p>Cumplir las condiciones analizadas no significa que el sitio sea seguro para aterrizar; la seguridad requiere evaluar muchos otros factores.</p>
          </section>

          <section className="insights-guide-section">
            <h3><AlertTriangle size={16} aria-hidden="true" /> Límites del análisis</h3>
            <p>El paso temporal puede pasar por alto eventos breves entre muestras. La resolución del terreno varía y puede no representar obstáculos pequeños.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
