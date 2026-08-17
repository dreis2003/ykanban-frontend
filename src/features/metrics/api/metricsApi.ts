import { httpClient } from '@/shared/api/httpClient'
import type { CurrentMetrics, FlowMetrics, MetricsPeriod } from '@/features/metrics/types'

export const metricsApi = {
  getCurrent: (projectId: string) => httpClient.get<CurrentMetrics>(`/projects/${projectId}/metrics/current`),
  getFlow: (projectId: string, period: MetricsPeriod) =>
    httpClient.get<FlowMetrics>(`/projects/${projectId}/metrics/flow?period=${period}`),
}
