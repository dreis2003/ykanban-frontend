import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus } from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import type { MembershipRole } from '@/features/auth/types'
import { entitlementsApi } from '@/features/entitlements/api/entitlementsApi'
import { invitationsApi } from '@/features/invitations/api/invitationsApi'
import { InviteMemberDialog } from '@/features/invitations/components/InviteMemberDialog/InviteMemberDialog'
import { InvitationsPanel } from '@/features/invitations/components/InvitationsPanel/InvitationsPanel'
import { MembersTable } from '@/features/members/components/MembersTable/MembersTable'
import { ApiError } from '@/shared/api/apiError'
import { resolveReturnTo } from '@/shared/utils/returnTo'
import styles from './MembersPage.module.css'

type Tab = 'users' | 'invitations'

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

export function MembersPage() {
  const { membershipRole, activeTenant } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: entitlements } = useQuery({
    queryKey: ['entitlements', activeTenant?.id],
    queryFn: entitlementsApi.current,
    enabled: Boolean(activeTenant),
  })
  const memberLimit = entitlements?.limits?.MAX_MEMBERS
  const canInvite = !memberLimit || memberLimit.state === 'AVAILABLE' || memberLimit.state === 'UNLIMITED'

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteInitialValues, setInviteInitialValues] = useState<{ email: string; role: MembershipRole } | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteNotice, setInviteNotice] = useState<string | null>(null)

  const tab: Tab = searchParams.get('tab') === 'invitations' ? 'invitations' : 'users'
  // `returnTo` é validado contra um allow-list (ver `resolveReturnTo`) antes de virar destino de
  // navegação — nunca confiar no valor bruto da query string, que pode ter sido manipulado.
  const backTarget = resolveReturnTo(searchParams.get('returnTo'))

  function switchTab(next: Tab) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === 'users') {
          params.delete('tab')
        } else {
          params.set('tab', next)
        }
        return params
      },
      { replace: true },
    )
  }

  const inviteMutation = useMutation({
    mutationFn: invitationsApi.invite,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
      // Convite reserva vaga de MAX_MEMBERS (ver ADR 0026, item 265) — nunca deixa a UI mostrando
      // capacidade desatualizada depois de um novo convite.
      queryClient.invalidateQueries({ queryKey: ['entitlements'] })
      setInviteOpen(false)
      setInviteError(null)
      setInviteNotice(
        created.emailDelivered
          ? `Convite enviado para ${created.invitation.email}.`
          : `Convite criado para ${created.invitation.email}, mas não foi possível enviar o e-mail. Use "Reenviar" na lista de convites.`,
      )
    },
    onError: (error: unknown) => setInviteError(errorMessageFrom(error)),
  })

  function openInviteDialog() {
    setInviteInitialValues(null)
    setInviteError(null)
    setInviteOpen(true)
  }

  function openInviteDialogWith(values: { email: string; role: MembershipRole }) {
    setInviteInitialValues(values)
    setInviteError(null)
    setInviteOpen(true)
  }

  // Segurança real é sempre validada no backend (todo endpoint de /members exige ADMIN) — isto só
  // evita o flash de uma tela que a pessoa não pode usar. Fica depois de todos os hooks (não antes
  // do primeiro return) porque `membershipRole` pode mudar em runtime — ex.: a própria pessoa se
  // autodegrada via ChangeRoleDialog — e um early-return antes dos hooks violaria as rules of hooks
  // ao pular chamadas entre renders.
  if (membershipRole !== 'ADMIN') {
    return <Navigate to={ROUTES.projects} replace />
  }

  return (
    <section className={styles.page}>
      <Link to={backTarget.to} className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden="true" />
        {backTarget.label}
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Membros</h1>
          <p className={styles.subtitle}>Gerencie papéis, acesso e convites da organização</p>
          {memberLimit && memberLimit.mode !== 'UNLIMITED' ? (
            <p className={styles.capacityHint} data-state={memberLimit.state}>
              {memberLimit.usage} de {memberLimit.value} vagas reservadas (usuários ativos + convites pendentes)
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.newInviteButton}
          onClick={openInviteDialog}
          disabled={!canInvite}
          title={canInvite ? undefined : 'Limite de usuários do plano atingido.'}
        >
          <Plus size={16} aria-hidden="true" />
          Convidar usuário
        </button>
      </header>

      {inviteNotice ? <p className={styles.inviteNotice}>{inviteNotice}</p> : null}

      <div className={styles.tabs} role="tablist" aria-label="Seção de administração">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'users'}
          className={styles.tabButton}
          data-active={tab === 'users'}
          onClick={() => switchTab('users')}
        >
          Usuários
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'invitations'}
          className={styles.tabButton}
          data-active={tab === 'invitations'}
          onClick={() => switchTab('invitations')}
        >
          Convites
        </button>
      </div>

      {tab === 'users' ? <MembersTable active={tab === 'users'} /> : null}
      {tab === 'invitations' ? (
        <InvitationsPanel active={tab === 'invitations'} onSendNewInvite={openInviteDialogWith} />
      ) : null}

      <InviteMemberDialog
        open={inviteOpen}
        isSubmitting={inviteMutation.isPending}
        errorMessage={inviteError}
        initialValues={inviteInitialValues}
        onSubmit={(values) => inviteMutation.mutate(values)}
        onClose={() => setInviteOpen(false)}
      />
    </section>
  )
}
