import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { signupApi } from '@/features/signup/api/signupApi'
import type { PublicPlan } from '@/features/signup/types'
import { ApiError } from '@/shared/api/apiError'
import { formatMoney } from '@/shared/utils/formatMoney'
import styles from './SubscribePage.module.css'

type Interval = 'MONTHLY' | 'YEARLY'

const INTERVAL_LABEL: Record<Interval, string> = { MONTHLY: 'mês', YEARLY: 'ano' }

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a assinatura. Tente novamente.'
}

/**
 * Tela pública de autoatendimento (ver ADR 0029/Prompt 30, PARTE A) — entrada comercial principal
 * do YKanban. Nunca pede senha/login (itens 17-18); frontend NUNCA envia `amount`/preço/Stripe
 * Price bruto — só `planPriceId`, o backend resolve o resto (item 251-252).
 */
export function SubscribePage() {
  const [searchParams] = useSearchParams()
  const wasCancelled = searchParams.get('checkout') === 'cancelled'

  const { data: plans, isLoading: loadingPlans } = useQuery({
    queryKey: ['public', 'plans'],
    queryFn: signupApi.listPlans,
  })

  const [organizationName, setOrganizationName] = useState('')
  const [email, setEmail] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [interval, setInterval] = useState<Interval>('MONTHLY')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const availableIntervals = useMemo(() => {
    const intervals = new Set<Interval>()
    for (const plan of plans ?? []) {
      for (const price of plan.prices) {
        intervals.add(price.billingInterval as Interval)
      }
    }
    return intervals
  }, [plans])

  const activePlan: PublicPlan | undefined = useMemo(() => {
    const list = plans ?? []
    if (selectedPlanId) {
      return list.find((plan) => plan.id === selectedPlanId) ?? list[0]
    }
    return list[0]
  }, [plans, selectedPlanId])

  const selectedPrice = useMemo(() => {
    if (!activePlan) return undefined
    return activePlan.prices.find((price) => price.billingInterval === interval) ?? activePlan.prices[0]
  }, [activePlan, interval])

  function handleNameChange(value: string) {
    setOrganizationName(value)
    if (!slugTouched) {
      setSlug(slugify(value))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !selectedPrice) return
    setFormError(null)
    setIsSubmitting(true)
    signupApi
      .createSignup({
        organizationName: organizationName.trim(),
        email: email.trim(),
        slug: slug.trim(),
        planPriceId: selectedPrice.id,
        termsAccepted,
      })
      .then((created) => {
        // Checkout URL nunca é logada — redirect direto (ver item 84 do Prompt 30).
        window.location.href = created.checkoutUrl
      })
      .catch((error: unknown) => {
        setFormError(errorMessageFrom(error))
        setIsSubmitting(false)
      })
  }

  const canSubmit =
    organizationName.trim().length > 0 &&
    email.trim().length > 0 &&
    slug.trim().length > 0 &&
    Boolean(selectedPrice) &&
    termsAccepted &&
    !isSubmitting

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>Comece a usar o YKanban</h1>
        <p className={styles.subtitle}>Escolha um plano, informe sua empresa e assine com segurança pela Stripe.</p>
      </section>

      {wasCancelled ? (
        <p className={styles.notice} role="status">
          O pagamento não foi concluído. Você pode tentar novamente quando quiser.
        </p>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Sua empresa</legend>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="organization-name">
              Nome da empresa
            </label>
            <input
              id="organization-name"
              className={styles.input}
              value={organizationName}
              onChange={(event) => handleNameChange(event.target.value)}
              disabled={isSubmitting}
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="contact-email">
              E-mail
            </label>
            <input
              id="contact-email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="organization-slug">
              Identificador da organização
            </label>
            <div className={styles.slugPreview}>
              ykanban.com/
              <input
                id="organization-slug"
                className={styles.slugInput}
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(slugify(event.target.value))
                }}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Escolha seu plano</legend>

          {availableIntervals.has('MONTHLY') && availableIntervals.has('YEARLY') ? (
            <div className={styles.intervalToggle} role="radiogroup" aria-label="Periodicidade">
              <button
                type="button"
                className={interval === 'MONTHLY' ? styles.intervalActive : styles.intervalOption}
                onClick={() => setInterval('MONTHLY')}
              >
                Mensal
              </button>
              <button
                type="button"
                className={interval === 'YEARLY' ? styles.intervalActive : styles.intervalOption}
                onClick={() => setInterval('YEARLY')}
              >
                Anual
              </button>
            </div>
          ) : null}

          {loadingPlans ? (
            <p className={styles.notice}>Carregando planos…</p>
          ) : !plans || plans.length === 0 ? (
            <p className={styles.notice}>Nenhum plano disponível para contratação no momento.</p>
          ) : (
            <div className={styles.planGrid}>
              {plans.map((plan) => {
                const price = plan.prices.find((p) => p.billingInterval === interval) ?? plan.prices[0]
                const isActive = activePlan?.id === plan.id
                return (
                  <button
                    type="button"
                    key={plan.id}
                    className={isActive ? styles.planCardActive : styles.planCard}
                    onClick={() => setSelectedPlanId(plan.id)}
                    disabled={isSubmitting}
                  >
                    <span className={styles.planName}>{plan.name}</span>
                    {price ? (
                      <span className={styles.planPrice}>
                        {formatMoney(price.amountMinor, price.currency)}
                        <span className={styles.planPriceUnit}>/{INTERVAL_LABEL[price.billingInterval as Interval]}</span>
                      </span>
                    ) : null}
                    {plan.description ? <span className={styles.planDescription}>{plan.description}</span> : null}
                  </button>
                )
              })}
            </div>
          )}
        </fieldset>

        {activePlan && selectedPrice ? (
          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>Resumo</legend>
            <div className={styles.summary}>
              <p className={styles.summaryPlan}>{activePlan.name}</p>
              <p className={styles.summaryPrice}>
                {formatMoney(selectedPrice.amountMinor, selectedPrice.currency)} /{' '}
                {INTERVAL_LABEL[selectedPrice.billingInterval as Interval]}
              </p>
            </div>
          </fieldset>
        ) : null}

        <label className={styles.termsRow}>
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            disabled={isSubmitting}
            required
          />
          <span>
            Li e aceito os <Link to={ROUTES.terms}>Termos de Uso</Link> e a{' '}
            <Link to={ROUTES.privacy}>Política de Privacidade</Link>.
          </span>
        </label>

        {formError ? (
          <p className={styles.error} role="alert">
            {formError}
          </p>
        ) : null}

        <button type="submit" className={styles.submit} disabled={!canSubmit}>
          {isSubmitting ? 'Preparando pagamento…' : 'Continuar para pagamento'}
        </button>
        <p className={styles.securityNote}>Pagamento seguro processado pela Stripe.</p>

        <p className={styles.loginHint}>
          Já possui conta? <Link to={ROUTES.login}>Entrar</Link>
        </p>
      </form>
    </div>
  )
}
