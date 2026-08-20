import styles from './TermsPage.module.css'

/**
 * Placeholder jurídico (ver ADR 0029/Prompt 30, PARTE C, item 38) — conteúdo NÃO revisado
 * juridicamente; existe só para o fluxo de aceite ter um destino real antes do lançamento
 * comercial. Substituir pelo texto definitivo antes de produção.
 */
export function TermsPage() {
  return (
    <article className={styles.page}>
      <p className={styles.draftNotice}>
        Rascunho — este texto ainda não foi revisado juridicamente e não deve ser considerado final.
      </p>
      <h1>Termos de Uso do YKanban</h1>
      <p>
        Estes Termos de Uso regem a contratação e utilização do YKanban, produto da Yakuza Studio. Ao assinar um
        plano, você concorda com estes termos.
      </p>
      <h2>1. Contratação</h2>
      <p>O serviço é contratado por assinatura recorrente, processada através da Stripe.</p>
      <h2>2. Uso do serviço</h2>
      <p>O YKanban deve ser utilizado de acordo com a finalidade para a qual foi disponibilizado.</p>
      <h2>3. Cancelamento</h2>
      <p>A assinatura pode ser cancelada a qualquer momento pelo administrador da organização.</p>
    </article>
  )
}
