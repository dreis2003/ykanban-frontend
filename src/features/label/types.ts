export interface Label {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface CreateLabelRequest {
  name: string
  color: string
}

export interface UpdateLabelRequest {
  name: string
  color: string
}
