import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { accountApi } from '@/features/account/api/accountApi'
import { useAuth } from '@/features/auth/AuthContext'
import { ApiError } from '@/shared/api/apiError'
import { formatDateTime } from '@/shared/utils/formatDate'
import styles from './AccountPage.module.css'

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/**
 * "Minha Conta" (ver ADR 0030/Prompt 31) — identidade GLOBAL do User, deliberadamente fora das
 * árvores de MainLayout/PlatformLayout (funciona independente de Tenant ativo, acessível a partir
 * das duas áreas — ver item 275). Alterar senha e "sair de todos os dispositivos" invalidam
 * IMEDIATAMENTE a sessão atual também (via `securityVersion`, ver JwtAuthenticationFilter) — por
 * isso as duas ações terminam forçando um novo login, nunca continuam "logadas" silenciosamente.
 */
export function AccountPage() {
  const { user, platformRoles, logout, refreshSession } = useAuth()
  const queryClient = useQueryClient()

  const { data: account, isLoading } = useQuery({ queryKey: ['account'], queryFn: accountApi.getAccount })

  // `null` = ainda não editado pelo usuário nesta sessão de tela — mostra o nome vindo do backend.
  // Evita sincronizar via useEffect (que causaria um render em cascata a cada refetch).
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const name = nameDraft ?? account?.name ?? ''
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [newEmail, setNewEmail] = useState('')
  const [emailChangePassword, setEmailChangePassword] = useState('')
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null)
  const [emailChangeMessage, setEmailChangeMessage] = useState<string | null>(null)

  const [forcedLogoutMessage, setForcedLogoutMessage] = useState<string | null>(null)

  // A sessão atual também é invalidada por essas duas ações (ver docstring acima) — aguarda um
  // instante para o usuário ler o aviso antes de redirecionar para /login.
  useEffect(() => {
    if (!forcedLogoutMessage) return
    const timeout = window.setTimeout(() => void logout(), 2500)
    return () => window.clearTimeout(timeout)
  }, [forcedLogoutMessage, logout])

  const updateProfileMutation = useMutation({
    mutationFn: accountApi.updateProfile,
    onSuccess: async () => {
      setProfileMessage('Perfil atualizado.')
      setProfileError(null)
      await queryClient.invalidateQueries({ queryKey: ['account'] })
      await refreshSession()
    },
    onError: (error: unknown) => {
      setProfileError(errorMessageFrom(error))
      setProfileMessage(null)
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: accountApi.changePassword,
    onSuccess: () => {
      setPasswordError(null)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setForcedLogoutMessage('Senha alterada. Por segurança, você foi desconectado(a) de todos os dispositivos, incluindo este — redirecionando para o login…')
    },
    onError: (error: unknown) => setPasswordError(errorMessageFrom(error)),
  })

  const requestEmailChangeMutation = useMutation({
    mutationFn: accountApi.requestEmailChange,
    onSuccess: async () => {
      setEmailChangeError(null)
      setEmailChangeMessage('Enviamos um e-mail de confirmação para o novo endereço.')
      setEmailChangePassword('')
      await queryClient.invalidateQueries({ queryKey: ['account'] })
    },
    onError: (error: unknown) => {
      setEmailChangeError(errorMessageFrom(error))
      setEmailChangeMessage(null)
    },
  })

  const resendEmailChangeMutation = useMutation({
    mutationFn: accountApi.resendEmailChange,
    onSuccess: () => setEmailChangeMessage('E-mail de confirmação reenviado.'),
    onError: (error: unknown) => setEmailChangeError(errorMessageFrom(error)),
  })

  const cancelEmailChangeMutation = useMutation({
    mutationFn: accountApi.cancelEmailChange,
    onSuccess: async () => {
      setEmailChangeMessage(null)
      setEmailChangeError(null)
      await queryClient.invalidateQueries({ queryKey: ['account'] })
    },
    onError: (error: unknown) => setEmailChangeError(errorMessageFrom(error)),
  })

  const revokeAllSessionsMutation = useMutation({
    mutationFn: accountApi.revokeAllSessions,
    onSuccess: () =>
      setForcedLogoutMessage('Todas as sessões foram encerradas, incluindo esta — redirecionando para o login…'),
    onError: (error: unknown) => setProfileError(errorMessageFrom(error)),
  })

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (updateProfileMutation.isPending) return
    updateProfileMutation.mutate({ name: name.trim() })
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (changePasswordMutation.isPending) return
    if (newPassword !== confirmNewPassword) {
      setPasswordError('As senhas não coincidem.')
      return
    }
    changePasswordMutation.mutate({ currentPassword, newPassword })
  }

  function handleEmailChangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (requestEmailChangeMutation.isPending) return
    requestEmailChangeMutation.mutate({ newEmail: newEmail.trim(), currentPassword: emailChangePassword })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.projects} className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            Y
          </span>
          <span className={styles.brandName}>YKanban</span>
        </Link>
        <nav className={styles.nav}>
          <Link to={ROUTES.projects} className={styles.navLink}>
            Voltar ao YKanban
          </Link>
          {platformRoles.includes('PLATFORM_ADMIN') ? (
            <Link to={ROUTES.platformDashboard} className={styles.navLink}>
              Administração da Plataforma
            </Link>
          ) : null}
        </nav>
      </header>

      <main className={styles.content}>
        <h1 className={styles.title}>Minha Conta</h1>
        <p className={styles.subtitle}>Identidade pessoal — independe da organização em que você está.</p>

        {forcedLogoutMessage ? (
          <p className={styles.warning} role="alert">
            {forcedLogoutMessage}
          </p>
        ) : null}

        {isLoading ? <p className={styles.hint}>Carregando…</p> : null}

        {account ? (
          <>
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Perfil</h2>
              {profileError ? (
                <p className={styles.error} role="alert">
                  {profileError}
                </p>
              ) : null}
              {profileMessage ? <p className={styles.success}>{profileMessage}</p> : null}
              <form className={styles.form} onSubmit={handleProfileSubmit} noValidate>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="account-name">
                    Nome
                  </label>
                  <input
                    id="account-name"
                    className={styles.input}
                    value={name}
                    onChange={(event) => setNameDraft(event.target.value)}
                    minLength={2}
                    maxLength={120}
                    required
                    disabled={updateProfileMutation.isPending}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="account-email">
                    E-mail
                  </label>
                  <input id="account-email" className={styles.input} value={account.email} readOnly disabled />
                </div>
                <button type="submit" className={styles.primaryButton} disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending ? 'Salvando…' : 'Salvar'}
                </button>
              </form>
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Alterar senha</h2>
              {passwordError ? (
                <p className={styles.error} role="alert">
                  {passwordError}
                </p>
              ) : null}
              <form className={styles.form} onSubmit={handlePasswordSubmit} noValidate>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="current-password">
                    Senha atual
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    className={styles.input}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={changePasswordMutation.isPending}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="new-password">
                    Nova senha
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    className={styles.input}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={changePasswordMutation.isPending}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="confirm-new-password">
                    Confirmar nova senha
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    className={styles.input}
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={changePasswordMutation.isPending}
                  />
                </div>
                <button type="submit" className={styles.primaryButton} disabled={changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending ? 'Alterando…' : 'Alterar senha'}
                </button>
              </form>
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Alterar e-mail</h2>
              {emailChangeError ? (
                <p className={styles.error} role="alert">
                  {emailChangeError}
                </p>
              ) : null}
              {emailChangeMessage ? <p className={styles.success}>{emailChangeMessage}</p> : null}

              {account.pendingEmailChange ? (
                <div className={styles.pendingEmailChange}>
                  <p>
                    Confirmação pendente para <strong>{account.pendingEmailChange.maskedNewEmail}</strong>, expira em{' '}
                    {formatDateTime(account.pendingEmailChange.expiresAt)}.
                  </p>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => resendEmailChangeMutation.mutate()}
                      disabled={resendEmailChangeMutation.isPending}
                    >
                      {resendEmailChangeMutation.isPending ? 'Reenviando…' : 'Reenviar e-mail de confirmação'}
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => cancelEmailChangeMutation.mutate()}
                      disabled={cancelEmailChangeMutation.isPending}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <form className={styles.form} onSubmit={handleEmailChangeSubmit} noValidate>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="new-email">
                      Novo e-mail
                    </label>
                    <input
                      id="new-email"
                      type="email"
                      className={styles.input}
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                      required
                      disabled={requestEmailChangeMutation.isPending}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="email-change-password">
                      Senha atual
                    </label>
                    <input
                      id="email-change-password"
                      type="password"
                      className={styles.input}
                      value={emailChangePassword}
                      onChange={(event) => setEmailChangePassword(event.target.value)}
                      autoComplete="current-password"
                      required
                      disabled={requestEmailChangeMutation.isPending}
                    />
                  </div>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={requestEmailChangeMutation.isPending}
                  >
                    {requestEmailChangeMutation.isPending ? 'Enviando…' : 'Solicitar troca de e-mail'}
                  </button>
                </form>
              )}
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Sessões</h2>
              <p className={styles.hint}>
                Encerre todas as sessões ativas de {user?.name ?? 'sua conta'} em qualquer dispositivo, incluindo esta.
              </p>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => revokeAllSessionsMutation.mutate()}
                disabled={revokeAllSessionsMutation.isPending}
              >
                {revokeAllSessionsMutation.isPending ? 'Encerrando…' : 'Sair de todos os dispositivos'}
              </button>
            </section>
          </>
        ) : null}
      </main>
    </div>
  )
}
