import styles from '../TermsPage/TermsPage.module.css'

/**
 * Placeholder jurídico (ver ADR 0029/Prompt 30, PARTE C, item 38) — conteúdo NÃO revisado
 * juridicamente; substituir pelo texto definitivo antes de produção. Reaproveita o mesmo estilo
 * de `TermsPage` (mesma família de conteúdo).
 */
export function PrivacyPage() {
  return (
    <article className={styles.page}>
      <p className={styles.draftNotice}>
        Rascunho — este texto ainda não foi revisado juridicamente e não deve ser considerado final.
      </p>
      <h1>Política de Privacidade do YKanban</h1>
      <p>
        Esta Política de Privacidade descreve como a Yakuza Studio trata os dados pessoais coletados através do
        YKanban.
      </p>
      <h2>1. Dados coletados</h2>
      <p>Nome da empresa, e-mail de contato e dados de pagamento processados diretamente pela Stripe.</p>
      <h2>2. Uso dos dados</h2>
      <p>Os dados são usados exclusivamente para provisionar e operar a assinatura contratada.</p>
      <h2>3. Contato</h2>
      <p>Dúvidas sobre privacidade podem ser enviadas para o suporte da Yakuza Studio.</p>
    </article>
  )
}
