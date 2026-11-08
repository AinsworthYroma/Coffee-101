import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import ProcessingGallery from './ProcessingGallery'

vi.mock('./CremaBackground', () => ({ default: () => null }))
vi.mock('./vendor/react-bits/GooeyNav', () => ({ default: ({ items, activeIndex, ariaLabel }: { items: { label: string; href: string }[]; activeIndex: number; ariaLabel: string }) => <nav aria-label={ariaLabel}>{items.map((item, index) => <a key={item.href} href={item.href} aria-current={index === activeIndex ? 'page' : undefined}>{item.label}</a>)}</nav> }))

afterEach(cleanup)

describe('parcours de prévisualisation', () => {
  it('présente la préparation avec la machine automatique', () => {
    window.history.replaceState({}, '', '/')
    render(<App />)
    expect(screen.getByRole('heading', { name: /comment veux-tu préparer ton café/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ouvrir la fiche Ta machine automatique' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /préparer mon café/i })).toHaveAttribute('href', '#ma-machine')
    expect(screen.getByRole('link', { name: /préparer/i, current: 'page' })).toBeInTheDocument()
  })

  it.each([
    ['explorer', /trois régions, autant de pistes/i],
    ['deguster', /ma bibliothèque/i],
  ])('affiche la vue %s', async (view, notice) => {
    window.history.replaceState({}, '', `/?vue=${view}`)
    render(<App />)
    expect(await screen.findByText(notice)).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /navigation principale/i }).querySelector('[aria-current="page"]')).toHaveAttribute('href', `?vue=${view}`)
  })
})

describe('galerie des traitements', () => {
  it('conserve le panneau ouvert depuis un aperçu clavier vers le guide', () => {
    const openGuide = vi.fn()
    render(<ProcessingGallery onGuide={openGuide} />)
    const nature = screen.getByRole('button', { name: /nature/i })
    act(() => nature.focus())
    expect(nature).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('link', { name: 'Découvrir : Nature' }))
    expect(openGuide).toHaveBeenCalledWith('nature')
    expect(nature).toHaveAttribute('aria-expanded', 'true')
  })
})