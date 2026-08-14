import { httpClient } from '@/shared/api/httpClient'
import type {
  AcceptanceCriterion,
  CreateAcceptanceCriterionRequest,
  MoveAcceptanceCriterionRequest,
  UpdateAcceptanceCriterionRequest,
} from '@/features/card/types'

export const acceptanceCriteriaApi = {
  create: (cardId: string, payload: CreateAcceptanceCriterionRequest) =>
    httpClient.post<AcceptanceCriterion>(`/cards/${cardId}/acceptance-criteria`, payload),
  update: (cardId: string, criterionId: string, payload: UpdateAcceptanceCriterionRequest) =>
    httpClient.patch<AcceptanceCriterion>(`/cards/${cardId}/acceptance-criteria/${criterionId}`, payload),
  complete: (cardId: string, criterionId: string) =>
    httpClient.post<AcceptanceCriterion>(`/cards/${cardId}/acceptance-criteria/${criterionId}/complete`),
  reopen: (cardId: string, criterionId: string) =>
    httpClient.post<AcceptanceCriterion>(`/cards/${cardId}/acceptance-criteria/${criterionId}/reopen`),
  move: (cardId: string, criterionId: string, payload: MoveAcceptanceCriterionRequest) =>
    httpClient.post<AcceptanceCriterion>(`/cards/${cardId}/acceptance-criteria/${criterionId}/move`, payload),
  remove: (cardId: string, criterionId: string) =>
    httpClient.delete<void>(`/cards/${cardId}/acceptance-criteria/${criterionId}`),
}
