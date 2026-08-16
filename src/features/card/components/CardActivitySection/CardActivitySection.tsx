import { useInfiniteQuery } from '@tanstack/react-query'
import { cardHistoryApi, CARD_HISTORY_PAGE_SIZE } from '@/features/card/api/cardHistoryApi'
import { formatHistoryEvent } from '@/features/card/utils/historyFormatter'
import { formatDateTime } from '@/shared/utils/formatDate'
import styles from './CardActivitySection.module.css'

interface Props {
  cardId: string
}

/**
 * Somente leitura — histórico é append-only, sem nenhuma ação de escrita nesta seção (ver ADR
 * 0015). Query própria, independente do resto do Card (mesmo padrão de `CardCommentsSection`).
 * Ordenação mais recente primeiro: "Carregar mais" busca eventos mais antigos e os acrescenta ao
 * final — já é a ordem visual correta, sem precisar inverter nada.
 */
export function CardActivitySection({ cardId }: Props) {
  const historyQuery = useInfiniteQuery({
    queryKey: ['card', cardId, 'history'],
    queryFn: ({ pageParam }) => cardHistoryApi.list(cardId, pageParam, CARD_HISTORY_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.page + 1 < lastPage.totalPages ? lastPage.page + 1 : undefined),
  })

  const events = historyQuery.data?.pages.flatMap((page) => page.content) ?? []

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>Atividade</h3>

      {historyQuery.isLoading ? <p className={styles.loading}>Carregando atividade…</p> : null}

      {historyQuery.isError ? (
        <div className={styles.loadError}>
          <p role="alert">Não foi possível carregar o histórico.</p>
          <button type="button" className={styles.retryButton} onClick={() => historyQuery.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {!historyQuery.isLoading && !historyQuery.isError && events.length === 0 ? (
        <p className={styles.emptyState}>Nenhuma atividade registrada ainda.</p>
      ) : null}

      {events.length > 0 ? (
        <ul className={styles.list} aria-label="Atividade">
          {events.map((event) => {
            const { title, detail } = formatHistoryEvent(event)
            return (
              <li key={event.id} className={styles.item}>
                <span className={styles.timestamp}>{formatDateTime(event.createdAt)}</span>
                <span className={styles.eventTitle}>{title}</span>
                {detail ? <span className={styles.eventDetail}>{detail}</span> : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {historyQuery.hasNextPage ? (
        <button
          type="button"
          className={styles.loadMore}
          onClick={() => historyQuery.fetchNextPage()}
          disabled={historyQuery.isFetchingNextPage}
        >
          {historyQuery.isFetchingNextPage ? 'Carregando…' : 'Carregar mais atividades'}
        </button>
      ) : null}
    </section>
  )
}
