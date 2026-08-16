import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { commentApi, COMMENT_PAGE_SIZE } from '@/features/card/api/commentApi'
import { useAuth } from '@/features/auth/AuthContext'
import type { Comment } from '@/features/card/types'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { formatDateTime } from '@/shared/utils/formatDate'
import type { PageResponse } from '@/shared/types/pageResponse'
import styles from './CardCommentsSection.module.css'

interface Props {
  cardId: string
  canManage: boolean
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

function wasEdited(comment: Comment): boolean {
  return !comment.deleted && new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime()
}

/**
 * Comentários carregam de forma independente do resto do Card (query própria, loading/erro só
 * nesta seção) — nunca fazem parte de `CardResponse`/`['card', cardId]` (ver ADR 0014). Paginação
 * ascendente por `createdAt` (mais antigos primeiro): a página 0 já cobre a conversa inteira para a
 * grande maioria dos Cards; "Carregar mais" busca a próxima página (mais recente) e a acrescenta ao
 * final — sem precisar inverter/prepend nada, e o comentário novo criado pelo usuário aparece
 * naturalmente perto do composer, sem exigir scroll manual.
 */
export function CardCommentsSection({ cardId, canManage }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['card', cardId, 'comments'] as const
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [pendingDeletion, setPendingDeletion] = useState<Comment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const commentsQuery = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => commentApi.list(cardId, pageParam, COMMENT_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.page + 1 < lastPage.totalPages ? lastPage.page + 1 : undefined),
  })

  const comments = commentsQuery.data?.pages.flatMap((page) => page.content) ?? []

  function patchComment(commentId: string, updater: (comment: Comment) => Comment) {
    queryClient.setQueryData<InfiniteData<PageResponse<Comment>>>(queryKey, (data) => {
      if (!data) return data
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          content: page.content.map((comment) => (comment.id === commentId ? updater(comment) : comment)),
        })),
      }
    })
  }

  const createMutation = useMutation({
    mutationFn: (content: string) => commentApi.create(cardId, { content }),
    onSuccess: () => {
      setNewContent('')
      setError(null)
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (err: unknown) => setError(errorMessageFrom(err)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      commentApi.update(cardId, commentId, { content }),
    onSuccess: (updated) => {
      patchComment(updated.id, () => updated)
      setEditingId(null)
      setError(null)
    },
    onError: (err: unknown) => setError(errorMessageFrom(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => commentApi.remove(cardId, commentId),
    onSuccess: (_data, commentId) => {
      patchComment(commentId, (comment) => ({ ...comment, content: null, deleted: true }))
      setPendingDeletion(null)
      setError(null)
    },
    onError: (err: unknown) => {
      setError(errorMessageFrom(err))
      setPendingDeletion(null)
    },
  })

  function submitNewComment() {
    const trimmed = newContent.trim()
    if (!trimmed || createMutation.isPending) return
    createMutation.mutate(trimmed)
  }

  function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitNewComment()
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      submitNewComment()
    }
  }

  function startEditing(comment: Comment) {
    setEditingId(comment.id)
    setEditingContent(comment.content ?? '')
    setError(null)
  }

  function submitEdit(commentId: string) {
    const trimmed = editingContent.trim()
    if (!trimmed || updateMutation.isPending) return
    updateMutation.mutate({ commentId, content: trimmed })
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>Comentários</h3>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {commentsQuery.isLoading ? <p className={styles.loading}>Carregando comentários…</p> : null}

      {commentsQuery.isError ? (
        <div className={styles.loadError}>
          <p role="alert">Não foi possível carregar os comentários.</p>
          <button type="button" className={styles.retryButton} onClick={() => commentsQuery.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {!commentsQuery.isLoading && !commentsQuery.isError && comments.length === 0 ? (
        <p className={styles.emptyState}>
          Nenhum comentário ainda.
          {canManage ? ' Adicione informações ou decisões relacionadas a este card.' : ''}
        </p>
      ) : null}

      {comments.length > 0 ? (
        <ul className={styles.list} aria-label="Comentários">
          {comments.map((comment) => {
            const isOwn = user?.id === comment.author.id
            const canEdit = canManage && isOwn && !comment.deleted
            const canDelete = canManage && !comment.deleted && (isOwn || user?.role === 'ADMIN')
            const isEditingThis = editingId === comment.id

            return (
              <li key={comment.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.author}>{comment.author.name}</span>
                  <span className={styles.timestamp}>{formatDateTime(comment.createdAt)}</span>
                  {wasEdited(comment) ? <span className={styles.editedTag}>editado</span> : null}
                </div>

                {comment.deleted ? (
                  <p className={styles.removed}>Comentário removido.</p>
                ) : isEditingThis ? (
                  <div className={styles.editForm}>
                    <textarea
                      className={styles.textarea}
                      value={editingContent}
                      onChange={(event) => setEditingContent(event.target.value)}
                      aria-label={`Editar comentário de ${comment.author.name}`}
                      autoFocus
                    />
                    <div className={styles.editActions}>
                      <button
                        type="button"
                        className={styles.save}
                        onClick={() => submitEdit(comment.id)}
                        disabled={updateMutation.isPending || !editingContent.trim()}
                      >
                        {updateMutation.isPending ? 'Salvando…' : 'Salvar'}
                      </button>
                      <button type="button" className={styles.cancel} onClick={() => setEditingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={styles.content}>{comment.content}</p>
                )}

                {!comment.deleted && !isEditingThis && (canEdit || canDelete) ? (
                  <div className={styles.itemActions}>
                    {canEdit ? (
                      <button type="button" className={styles.actionLink} onClick={() => startEditing(comment)}>
                        Editar
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button type="button" className={styles.actionLink} onClick={() => setPendingDeletion(comment)}>
                        Remover
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {commentsQuery.hasNextPage ? (
        <button
          type="button"
          className={styles.loadMore}
          onClick={() => commentsQuery.fetchNextPage()}
          disabled={commentsQuery.isFetchingNextPage}
        >
          {commentsQuery.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
        </button>
      ) : null}

      {canManage ? (
        <form className={styles.composer} onSubmit={handleAddSubmit}>
          <label htmlFor={`comment-composer-${cardId}`} className={styles.composerLabel}>
            Adicionar comentário
          </label>
          <textarea
            id={`comment-composer-${cardId}`}
            className={styles.textarea}
            value={newContent}
            onChange={(event) => setNewContent(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Adicionar comentário…"
            disabled={createMutation.isPending}
          />
          <button type="submit" className={styles.commentButton} disabled={createMutation.isPending || !newContent.trim()}>
            {createMutation.isPending ? 'Enviando…' : 'Comentar'}
          </button>
        </form>
      ) : null}

      <ConfirmDialog
        open={pendingDeletion !== null}
        title="Remover comentário"
        description="Remover este comentário?"
        confirmLabel="Remover"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => pendingDeletion && deleteMutation.mutate(pendingDeletion.id)}
        onCancel={() => setPendingDeletion(null)}
      />
    </section>
  )
}
