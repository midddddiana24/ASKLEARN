import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Native scrolling, bounded decorative motion, and no initially hidden content. */
export default function HomeMotion() {
  const { pathname } = useLocation()
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const animations = new Set<Animation>()
    let scrollFrame = 0, observer: IntersectionObserver | undefined
    let header: HTMLElement | null = null, stage: HTMLElement | null = null, progress: HTMLElement | null = null
    const update = () => {
      scrollFrame = 0
      header?.classList.toggle('is-scrolled', scrollY > 24)
      const distance = document.documentElement.scrollHeight - innerHeight
      if (progress) progress.style.transform = `scaleX(${reduced.matches ? 0 : distance > 0 ? Math.min(1, Math.max(0, scrollY / distance)) : 0})`
      if (stage) stage.style.transform = reduced.matches ? 'none' : `translate3d(0,${-Math.min(24, Math.max(0, scrollY) * .045)}px,0)`
    }
    const schedule = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(update) }
    const cancel = () => { if (reduced.matches) { animations.forEach(animation => animation.cancel()); animations.clear() }; schedule() }
    const setup = requestAnimationFrame(() => {
      header = document.querySelector('.welcome .public-header')
      stage = document.querySelector('.welcome .lesson-stage')
      progress = document.querySelector('.home-scroll-progress')
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) {
          if (!reduced.matches && !entry.target.matches(':focus-within')) {
            const node = entry.target, siblings = Array.from(node.parentElement?.children || [])
            const stagger = node.matches('.how-list article, .tour-images figure') ? Math.min(siblings.indexOf(node) * 75, 225) : 0
            const animation = node.animate([{ opacity: .35, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 550, delay: stagger, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' })
            animations.add(animation); animation.onfinish = () => animations.delete(animation)
          }
          observer?.unobserve(entry.target)
        }
      }, { threshold: .12 })
      document.querySelectorAll('.welcome .hero-copy, .welcome .lesson-object, .welcome-how>h2, .how-list article, .tour-section>h2, .tour-section>p, .tour-images figure, .public-footer, .dashboard-page>.profile-welcome, .dashboard-page>.history-section').forEach(node => observer!.observe(node))
      update()
    })
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    reduced.addEventListener('change', cancel)
    return () => {
      cancelAnimationFrame(setup); cancelAnimationFrame(scrollFrame); observer?.disconnect()
      window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); reduced.removeEventListener('change', cancel)
      animations.forEach(animation => animation.cancel()); header?.classList.remove('is-scrolled')
      stage?.style.removeProperty('transform'); progress?.style.removeProperty('transform')
    }
  }, [pathname])
  return null
}
