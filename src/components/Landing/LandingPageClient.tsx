"use client"

import React, { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/i18n/provider"

const MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN_URL ?? "https://laurenastudio.pro"

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".lp-fade-up, .lp-stagger")
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target) }
        })
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function Sparkle({ size = 16, style, delay = 0 }: { size?: number; style?: React.CSSProperties; delay?: number }) {
  return (
    <svg className="lp-sparkle" width={size} height={size} viewBox="0 0 24 24"
      style={{ ...style, animationDelay: `${delay}s` }} aria-hidden="true">
      <path d="M12 0 L13.5 10.5 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 10.5 Z" fill="currentColor" />
    </svg>
  )
}

function buildTerrainPaths(cols = 36, rows = 14, width = 1600, height = 600) {
  const horizon = height * 0.05
  const hs = Array.from({ length: cols + 1 }, (_, i) => {
    const x = i / cols
    return (
      Math.sin(x * 6.2) * 30 +
      Math.sin(x * 2.1 + 1) * 70 +
      Math.sin(x * 11.3 + 0.5) * 18 +
      Math.exp(-Math.pow((x - 0.22) * 3.2, 2)) * 110
    )
  })
  const proj = (c: number, r: number): [number, number] => {
    const t = r / rows
    const sp = 0.18 + t * 0.82
    const x = width / 2 + ((c / cols) - 0.5) * width * sp * 2
    const y = horizon + Math.pow(t, 1.35) * (height - horizon) - hs[c] * (0.2 + t * t * 0.9)
    return [x, y]
  }
  const hLines: React.ReactNode[] = []
  for (let r = 0; r <= rows; r++) {
    let d = ""
    for (let c = 0; c <= cols; c++) {
      const [x, y] = proj(c, r)
      d += (c === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1) + " "
    }
    hLines.push(<path key={"h" + r} className={"lp-grid-line" + (r > rows - 3 ? " near" : "")} d={d} />)
  }
  const vLines: React.ReactNode[] = []
  for (let c = 0; c <= cols; c++) {
    let d = ""
    for (let r = 0; r <= rows; r++) {
      const [x, y] = proj(c, r)
      d += (r === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1) + " "
    }
    vLines.push(<path key={"v" + c} className="lp-grid-line" d={d} />)
  }
  return { hLines, vLines, width, height }
}

function SiteBackdrop() {
  const { hLines, vLines, width, height } = buildTerrainPaths()
  return (
    <>
      <div className="lp-site-terrain" aria-hidden="true">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMax slice">
          <g>{hLines}{vLines}</g>
        </svg>
      </div>
      <div className="lp-site-glow" aria-hidden="true" />
    </>
  )
}

function Announce() {
  const { t } = useI18n()
  const [closed, setClosed] = useState(false)
  if (closed) return null
  return (
    <div className="lp-announce" style={{ position: "relative" }}>
      <span>
        {t("lp.announce.prefix")} <code>LAURENA30</code> {t("lp.announce.suffix")}
      </span>
      <button className="lp-announce-close" onClick={() => setClosed(true)} aria-label={t("lp.announce.close")}>✕</button>
    </div>
  )
}

function Nav({ session, planActive }: { session: ReturnType<typeof useSession>["data"]; planActive: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const href = !session
    ? "/auth/login?return_to=%2Fchat"
    : planActive ? "/chat/new" : `${MAIN_DOMAIN}/escolher-plano`
  const label = !session
    ? t("lp.nav.cta.start")
    : planActive ? t("lp.nav.cta.chat") : t("lp.nav.cta.activate")
  const handleCta = (e: React.MouseEvent) => {
    if (session && planActive) { e.preventDefault(); router.push("/chat/new") }
  }
  return (
    <nav className="lp-nav">
      <div className="lp-container lp-nav-inner">
        <a className="lp-brand" href="#">
          <div className="lp-brand-mark" />
          <span className="lp-brand-name">Laurena Builder</span>
          <span className="lp-brand-dot" />
        </a>
        <div className="lp-nav-links">
          <a href="#lp-como">{t("lp.nav.howItWorks")}</a>
          <a href="#lp-exemplos">{t("lp.nav.examples")}</a>
          <a href="#lp-recursos">{t("lp.nav.resources")}</a>
          <a href="#lp-precos">{t("lp.nav.pricing")}</a>
          <a href="#lp-faq">{t("lp.nav.faq")}</a>
        </div>
        <a className="lp-nav-cta" href={href} onClick={handleCta}>
          {label} <span className="lp-arrow">→</span>
        </a>
      </div>
    </nav>
  )
}

function Hero({ session, planActive }: { session: ReturnType<typeof useSession>["data"]; planActive: boolean }) {
  const { t } = useI18n()
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  const suggestions = [
    t("lp.suggestion.0"),
    t("lp.suggestion.1"),
    t("lp.suggestion.2"),
    t("lp.suggestion.3"),
    t("lp.suggestion.4"),
  ]

  const primaryHref = !session
    ? "/auth/login?return_to=%2Fchat"
    : planActive ? "/chat/new" : `${MAIN_DOMAIN}/escolher-plano`

  const handleSubmit = () => {
    if (!session) router.push("/auth/login?return_to=%2Fchat")
    else if (!planActive) { window.location.href = `${MAIN_DOMAIN}/escolher-plano` }
    else router.push("/chat/new")
  }

  const handlePrimaryClick = (e: React.MouseEvent) => {
    if (session && planActive) { e.preventDefault(); router.push("/chat/new") }
  }

  const primaryLabel = !session
    ? t("lp.hero.cta.startFree")
    : planActive ? t("lp.hero.cta.chat") : t("lp.hero.cta.activate")

  return (
    <section className="lp-hero" id="lp-hero">
      <div className="lp-hero-wordmark" data-text="LAURENA" aria-hidden="true">LAURENA</div>
      <Sparkle size={14} style={{ top: "18%", left: "8%" }} delay={0.2} />
      <Sparkle size={10} style={{ top: "24%", right: "12%" }} delay={0.8} />
      <Sparkle size={18} style={{ bottom: "40%", left: "14%" }} delay={1.6} />
      <Sparkle size={12} style={{ top: "42%", right: "9%" }} delay={2.1} />

      <div className="lp-container">
        <div className="lp-stagger in" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="lp-hero-tag">
            <span className="lp-dot" />
            <span className="lp-mono lp-upper" style={{ fontSize: 11 }}>{t("lp.hero.tag")}</span>
          </div>

          <h1 className="lp-h1">
            {t("lp.hero.h1.part1")}
            <span className="lp-line2"><em>{t("lp.hero.h1.part2")}</em></span>
          </h1>

          <p className="lp-hero-sub">{t("lp.hero.sub")}</p>

          <div className="lp-hero-ctas">
            <a className="lp-hero-cta lp-primary" href={primaryHref} onClick={handlePrimaryClick}>
              {primaryLabel}
            </a>
            <a className="lp-hero-cta lp-secondary" href={`${MAIN_DOMAIN}/escolher-plano`}>
              {t("lp.hero.cta.plans")}
              <span className="lp-price" style={{ color: "rgba(255,255,255,0.75)" }}>{t("lp.hero.cta.price")}</span>
            </a>
          </div>

          <div className="lp-prompt-wrap">
            <div className="lp-prompt-box">
              <div className="lp-prompt-label">
                <span>{t("lp.prompt.label")}</span>
                <span style={{ marginLeft: "auto", color: "var(--lp-ink-3)", fontSize: 10 }}>{value.length}/400</span>
              </div>
              <textarea
                ref={inputRef}
                className="lp-prompt-input"
                placeholder={t("lp.prompt.placeholder")}
                value={value}
                maxLength={400}
                onChange={(e) => setValue(e.target.value)}
                rows={3}
              />
              <div className="lp-prompt-actions">
                <div className="lp-prompt-tools">
                  <button className="lp-prompt-tool">{t("lp.prompt.attach")}</button>
                  <button className="lp-prompt-tool">{t("lp.prompt.style")}</button>
                </div>
                <button className="lp-prompt-submit" onClick={handleSubmit}>
                  {t("lp.prompt.submit")} <span className="lp-arrow">↗</span>
                </button>
              </div>
            </div>
            <div className="lp-prompt-suggestions">
              {suggestions.map((s) => (
                <button key={s} className="lp-chip" onClick={() => { setValue(s); inputRef.current?.focus() }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function MarqueeTicker() {
  const { t } = useI18n()
  const items = Array.from({ length: 12 }, (_, i) => t(`lp.marquee.${i}`))
  const Track = () => (
    <span>
      {items.map((item, i) => (
        <React.Fragment key={i}>{item}<em>✦</em></React.Fragment>
      ))}
    </span>
  )
  return (
    <div className="lp-marquee">
      <div className="lp-marquee-track">
        <Track /><Track />
      </div>
    </div>
  )
}

function Steps() {
  const { t } = useI18n()
  const steps = [
    {
      n: t("lp.step.1.n"),
      title: t("lp.step.1.title"),
      desc: t("lp.step.1.desc"),
      visual: (
        <>
          <div className="lp-step-row"><span className="lp-step-tag">USER</span><span>{t("lp.step.1.v.user1")}</span></div>
          <div className="lp-step-row"><span className="lp-step-tag lp-ok">AI</span><span>{t("lp.step.1.v.ai1")}</span></div>
          <div className="lp-step-row"><span className="lp-step-tag">USER</span><span className="lp-blink">{t("lp.step.1.v.user2")}</span></div>
        </>
      ),
    },
    {
      n: t("lp.step.2.n"),
      title: t("lp.step.2.title"),
      desc: t("lp.step.2.desc"),
      visual: (
        <>
          <div className="lp-step-row"><span>▸ {t("lp.step.2.v.0")}</span><span className="lp-step-bar" /><span className="lp-ok">ok</span></div>
          <div className="lp-step-row"><span>▸ {t("lp.step.2.v.1")}</span><span className="lp-step-bar" /><span className="lp-ok">ok</span></div>
          <div className="lp-step-row"><span>▸ {t("lp.step.2.v.2")}</span><span className="lp-step-bar" /><span className="lp-ok">ok</span></div>
          <div className="lp-step-row"><span>▸ {t("lp.step.2.v.3")}</span><span className="lp-step-bar" /><span className="lp-ok">∞</span></div>
        </>
      ),
    },
    {
      n: t("lp.step.3.n"),
      title: t("lp.step.3.title"),
      desc: t("lp.step.3.desc"),
      visual: (
        <>
          <div className="lp-step-row"><span>→ deploy</span><span className="lp-step-bar" /><span className="lp-ok">live</span></div>
          <div className="lp-step-row"><span>→ Cloudflare</span><span className="lp-step-bar" /><span className="lp-ok">{t("lp.step.3.v.active")}</span></div>
          <div className="lp-step-row"><span>→ HTTPS</span><span className="lp-step-bar" /><span className="lp-ok">✓</span></div>
          <div className="lp-step-row"><span>→ URL</span><span className="lp-step-bar" /><span className="lp-ok">meusite.com</span></div>
        </>
      ),
    },
  ]
  return (
    <section className="lp-section" id="lp-como">
      <div className="lp-container">
        <div className="lp-section-head lp-fade-up">
          <div>
            <div className="lp-section-eyebrow">{t("lp.steps.eyebrow")}</div>
            <h2 className="lp-section-title">{t("lp.steps.title.main")} <em>{t("lp.steps.title.em")}</em>.</h2>
          </div>
          <p className="lp-section-lede">{t("lp.steps.lede")}</p>
        </div>
        <div className="lp-steps lp-stagger">
          {steps.map((s, i) => (
            <div className="lp-step" key={i}>
              <div className="lp-step-num">{s.n}</div>
              <h3 className="lp-step-title">{s.title}</h3>
              <p className="lp-step-desc">{s.desc}</p>
              <div className="lp-step-visual">{s.visual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Showcase() {
  const { t } = useI18n()
  return (
    <section className="lp-section" id="lp-exemplos">
      <div className="lp-container">
        <div className="lp-section-head lp-fade-up">
          <div>
            <div className="lp-section-eyebrow">{t("lp.showcase.eyebrow")}</div>
            <h2 className="lp-section-title">{t("lp.showcase.title.main")} <em>{t("lp.showcase.title.em")}</em>.</h2>
          </div>
          <p className="lp-section-lede">{t("lp.showcase.lede")}</p>
        </div>
        <div className="lp-showcase-grid lp-stagger">
          <div className="lp-site-card lp-s-a">
            <div className="lp-frame">
              <div className="lp-frame-bar"><i /><i /><i /><span className="lp-frame-url lp-mono">atlas-studio.com</span></div>
              <div className="lp-frame-body">
                <div className="lp-mock lp-mock-a">
                  <div className="lp-m-nav"><span>atlas.</span><span>work · about · contact</span></div>
                  <div className="lp-m-img" style={{ top: 46, right: 20, width: "45%", height: "48%" }} />
                  <div className="lp-m-hero">Architecture as a form of listening.</div>
                  <div className="lp-m-sub">Portfolio — Atlas Studio, Lisbon.</div>
                  <div className="lp-m-btn">view projects →</div>
                </div>
              </div>
            </div>
            <div className="lp-meta">
              <span className="lp-meta-name">Atlas Studio</span>
              <span className="lp-meta-kind">{t("lp.showcase.kind.portfolio")}</span>
            </div>
          </div>

          <div className="lp-site-card lp-s-b">
            <div className="lp-frame">
              <div className="lp-frame-bar"><i /><i /><i /><span className="lp-frame-url lp-mono">corvo-coffee.br</span></div>
              <div className="lp-frame-body">
                <div className="lp-mock lp-mock-b">
                  <div className="lp-m-nav"><span>corvo ☕</span><span>menu · sobre</span></div>
                  <div className="lp-m-img" style={{ top: 40, left: 18, width: "42%", height: "45%" }} />
                  <div className="lp-m-hero">Café de origem,<br />torra semanal.</div>
                  <div className="lp-m-sub">Grãos selecionados por rota e altitude.</div>
                  <div className="lp-m-btn">loja →</div>
                </div>
              </div>
            </div>
            <div className="lp-meta">
              <span className="lp-meta-name">Corvo Coffee</span>
              <span className="lp-meta-kind">{t("lp.showcase.kind.ecommerce")}</span>
            </div>
          </div>

          <div className="lp-site-card lp-s-c">
            <div className="lp-frame">
              <div className="lp-frame-bar"><i /><i /><i /><span className="lp-frame-url lp-mono">payloop.io</span></div>
              <div className="lp-frame-body">
                <div className="lp-mock lp-mock-c">
                  <div className="lp-m-nav" style={{ color: "#bfb7a8" }}><span>payloop</span><span>features · pricing · docs</span></div>
                  <div className="lp-m-img" style={{ top: 50, right: 18, width: "40%", height: "44%", borderRadius: 10 }} />
                  <div className="lp-m-hero" style={{ color: "#f4efe6" }}>Invoicing for infra teams.</div>
                  <div className="lp-m-sub">API-first billing with granular usage metering.</div>
                  <div className="lp-m-btn" style={{ color: "var(--lp-accent)", borderColor: "var(--lp-accent)" }}>start free →</div>
                </div>
              </div>
            </div>
            <div className="lp-meta">
              <span className="lp-meta-name">Payloop</span>
              <span className="lp-meta-kind">{t("lp.showcase.kind.saas")}</span>
            </div>
          </div>

          <div className="lp-site-card lp-s-d">
            <div className="lp-frame">
              <div className="lp-frame-bar"><i /><i /><i /><span className="lp-frame-url lp-mono">note.neon.xyz</span></div>
              <div className="lp-frame-body">
                <div className="lp-mock lp-mock-d">
                  <div className="lp-m-nav"><span>neon/notes</span><span>#journal</span></div>
                  <div className="lp-m-hero" style={{ fontSize: 18 }}>Field notes on building<br />slow software.</div>
                  <div className="lp-m-sub">Weekly essays. No tracking.</div>
                  <div className="lp-m-btn">subscribe</div>
                </div>
              </div>
            </div>
            <div className="lp-meta">
              <span className="lp-meta-name">Neon Notes</span>
              <span className="lp-meta-kind">{t("lp.showcase.kind.blog")}</span>
            </div>
          </div>

          <div className="lp-site-card lp-s-e">
            <div className="lp-frame">
              <div className="lp-frame-bar"><i /><i /><i /><span className="lp-frame-url lp-mono">prisma.fest</span></div>
              <div className="lp-frame-body">
                <div className="lp-mock lp-mock-e">
                  <div className="lp-m-nav" style={{ color: "rgba(255,255,255,0.8)" }}><span>PRISMA</span><span>26 · rio</span></div>
                  <div className="lp-m-hero" style={{ fontSize: 26, color: "#fff" }}>Prisma<br />Fest 26</div>
                  <div className="lp-m-sub" style={{ color: "rgba(255,255,255,0.75)" }}>Música, arte, light design.</div>
                  <div className="lp-m-btn">ingressos →</div>
                </div>
              </div>
            </div>
            <div className="lp-meta">
              <span className="lp-meta-name">Prisma Fest</span>
              <span className="lp-meta-kind">{t("lp.showcase.kind.event")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Features() {
  const { t } = useI18n()
  const items = [
    { n: "01", title: t("lp.feature.1.title"), desc: t("lp.feature.1.desc"), spec: [t("lp.feature.1.specKey"), t("lp.feature.1.specVal")] },
    { n: "02", title: t("lp.feature.2.title"), desc: t("lp.feature.2.desc"), spec: [t("lp.feature.2.specKey"), t("lp.feature.2.specVal")] },
    { n: "03", title: t("lp.feature.3.title"), desc: t("lp.feature.3.desc"), spec: [t("lp.feature.3.specKey"), t("lp.feature.3.specVal")] },
    { n: "04", title: t("lp.feature.4.title"), desc: t("lp.feature.4.desc"), spec: [t("lp.feature.4.specKey"), t("lp.feature.4.specVal")] },
    { n: "05", title: t("lp.feature.5.title"), desc: t("lp.feature.5.desc"), spec: [t("lp.feature.5.specKey"), t("lp.feature.5.specVal")] },
    { n: "06", title: t("lp.feature.6.title"), desc: t("lp.feature.6.desc"), spec: [t("lp.feature.6.specKey"), t("lp.feature.6.specVal")] },
  ]
  return (
    <section className="lp-section" id="lp-recursos">
      <div className="lp-container">
        <div className="lp-section-head lp-fade-up">
          <div>
            <div className="lp-section-eyebrow">{t("lp.features.eyebrow")}</div>
            <h2 className="lp-section-title">{t("lp.features.title.main")} <em>{t("lp.features.title.em")}</em>.</h2>
          </div>
          <p className="lp-section-lede">{t("lp.features.lede")}</p>
        </div>
        <div className="lp-features lp-stagger">
          {items.map((it) => (
            <div className="lp-feature" key={it.n}>
              <div className="lp-feature-num">{it.n}</div>
              <h3 className="lp-feature-title">{it.title}</h3>
              <p className="lp-feature-desc">{it.desc}</p>
              <div className="lp-feature-spec">
                <span>{it.spec[0]}</span>
                <b>{it.spec[1]}</b>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing({ session }: { session: ReturnType<typeof useSession>["data"]; planActive: boolean }) {
  const { t } = useI18n()
  const plans = [
    {
      name: "Starter", price: "49", per: t("lp.pricing.per"),
      desc: t("lp.plan.starter.desc"),
      features: [
        t("lp.plan.starter.f0"), t("lp.plan.starter.f1"), t("lp.plan.starter.f2"),
        t("lp.plan.starter.f3"), t("lp.plan.starter.f4"), t("lp.plan.starter.f5"),
      ],
      cta: t("lp.plan.starter.cta"),
      href: !session ? "/auth/login?return_to=%2Fchat" : `${MAIN_DOMAIN}/escolher-plano`,
      featured: false,
    },
    {
      name: "Professional", price: "129", per: t("lp.pricing.per"),
      desc: t("lp.plan.pro.desc"),
      features: [
        t("lp.plan.pro.f0"), t("lp.plan.pro.f1"), t("lp.plan.pro.f2"),
        t("lp.plan.pro.f3"), t("lp.plan.pro.f4"), t("lp.plan.pro.f5"),
      ],
      cta: t("lp.plan.pro.cta"),
      href: `${MAIN_DOMAIN}/escolher-plano`,
      featured: true,
    },
    {
      name: "Business", price: "349", per: t("lp.pricing.per"),
      desc: t("lp.plan.business.desc"),
      features: [
        t("lp.plan.business.f0"), t("lp.plan.business.f1"), t("lp.plan.business.f2"),
        t("lp.plan.business.f3"), t("lp.plan.business.f4"), t("lp.plan.business.f5"),
      ],
      cta: t("lp.plan.business.cta"),
      href: `${MAIN_DOMAIN}/escolher-plano`,
      featured: false,
    },
  ]
  return (
    <section className="lp-section" id="lp-precos">
      <div className="lp-container">
        <div className="lp-section-head lp-fade-up">
          <div>
            <div className="lp-section-eyebrow">{t("lp.pricing.eyebrow")}</div>
            <h2 className="lp-section-title">{t("lp.pricing.title.main")} <em>{t("lp.pricing.title.em")}</em>{t("lp.pricing.title.end")}</h2>
          </div>
          <p className="lp-section-lede">{t("lp.pricing.lede")}</p>
        </div>
        <div className="lp-pricing lp-stagger">
          {plans.map((p) => (
            <div className={`lp-plan${p.featured ? " lp-featured" : ""}`} key={p.name}>
              <div className="lp-plan-name">{p.name}</div>
              <div className="lp-plan-price">
                <span className="lp-plan-cur">R$</span>
                <span className="lp-plan-amt">{p.price}</span>
                <span className="lp-plan-per">{p.per}</span>
              </div>
              <div className="lp-plan-desc">{p.desc}</div>
              <ul className="lp-plan-list">
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <a className="lp-plan-cta" href={p.href}>
                {p.cta} <span className="lp-arrow">→</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQ() {
  const { t } = useI18n()
  const [open, setOpen] = useState(0)
  const items = Array.from({ length: 6 }, (_, i) => ({
    q: t(`lp.faq.${i}.q`),
    a: t(`lp.faq.${i}.a`),
  }))
  return (
    <section className="lp-section" id="lp-faq">
      <div className="lp-container">
        <div className="lp-section-head lp-fade-up">
          <div>
            <div className="lp-section-eyebrow">{t("lp.faq.eyebrow")}</div>
            <h2 className="lp-section-title">{t("lp.faq.title.main")} <em>{t("lp.faq.title.em")}</em>.</h2>
          </div>
          <p className="lp-section-lede">{t("lp.faq.lede")}</p>
        </div>
        <div className="lp-faq lp-fade-up">
          {items.map((it, i) => (
            <div
              key={i}
              className="lp-faq-item"
              data-open={String(open === i)}
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              <div className="lp-faq-num">0{i + 1}</div>
              <div>
                <div className="lp-faq-q">{it.q}</div>
                <div className="lp-faq-a">{it.a}</div>
              </div>
              <div className="lp-faq-toggle">+</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTASection({ session, planActive }: { session: ReturnType<typeof useSession>["data"]; planActive: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const href = !session
    ? "/auth/login?return_to=%2Fchat"
    : planActive ? "/chat/new" : `${MAIN_DOMAIN}/escolher-plano`
  const handleClick = (e: React.MouseEvent) => {
    if (session && planActive) { e.preventDefault(); router.push("/chat/new") }
  }
  return (
    <section className="lp-cta">
      <Sparkle size={14} style={{ top: "18%", left: "16%" }} />
      <Sparkle size={10} style={{ top: "30%", right: "20%" }} delay={1} />
      <Sparkle size={16} style={{ bottom: "24%", left: "22%" }} delay={2} />
      <div className="lp-container lp-fade-up">
        <h2 className="lp-cta-h2">
          {t("lp.cta.h2.line1")}<br />
          {t("lp.cta.h2.line2")} <em>{t("lp.cta.h2.em")}</em>.
        </h2>
        <p className="lp-cta-sub">{t("lp.cta.sub")}</p>
        <a className="lp-cta-btn" href={href} onClick={handleClick}>
          {t("lp.cta.btn")} <span className="lp-arrow">→</span>
        </a>
      </div>
    </section>
  )
}

function Footer() {
  const { t } = useI18n()
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <div className="lp-brand">
              <div className="lp-brand-mark" />
              <span className="lp-brand-name">Laurena Builder</span>
            </div>
            <p>{t("lp.footer.desc")}</p>
          </div>
          <div className="lp-footer-col">
            <h4>{t("lp.footer.col.product")}</h4>
            <ul>
              <li><a href="#">{t("lp.footer.product.features")}</a></li>
              <li><a href="#">{t("lp.footer.product.templates")}</a></li>
              <li><a href="#">{t("lp.footer.product.changelog")}</a></li>
              <li><a href="#">{t("lp.footer.product.roadmap")}</a></li>
            </ul>
          </div>
          <div className="lp-footer-col">
            <h4>{t("lp.footer.col.company")}</h4>
            <ul>
              <li><a href="#">{t("lp.footer.company.about")}</a></li>
              <li><a href="#">{t("lp.footer.company.careers")}</a></li>
              <li><a href="#">{t("lp.footer.company.contact")}</a></li>
              <li><a href="#">{t("lp.footer.company.press")}</a></li>
            </ul>
          </div>
          <div className="lp-footer-col">
            <h4>{t("lp.footer.col.resources")}</h4>
            <ul>
              <li><a href="#">{t("lp.footer.resources.docs")}</a></li>
              <li><a href="#">{t("lp.footer.resources.guides")}</a></li>
              <li><a href="#">{t("lp.footer.resources.community")}</a></li>
              <li><a href="#">{t("lp.footer.resources.status")}</a></li>
            </ul>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>{t("lp.footer.copyright")}</span>
          <span>v1.0.4 — build 2a7f</span>
          <span>{t("lp.footer.terms")}</span>
        </div>
      </div>
    </footer>
  )
}

export default function LandingPageClient() {
  const { data: session } = useSession()
  const planActive = (session?.user as { planActive?: boolean } | null)?.planActive ?? false
  useReveal()

  return (
    <div className="landing-page">
      <SiteBackdrop />
      <Announce />
      <Nav session={session} planActive={planActive} />
      <Hero session={session} planActive={planActive} />
      <MarqueeTicker />
      <Steps />
      <Showcase />
      <Features />
      <Pricing session={session} planActive={planActive} />
      <FAQ />
      <CTASection session={session} planActive={planActive} />
      <Footer />
    </div>
  )
}
