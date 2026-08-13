import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Garante desmontagem do DOM entre testes independentemente da auto-detecção do RTL para
// Vitest — sem isso, arquivos com mais de um `render()` acumulam elementos entre testes.
afterEach(() => {
  cleanup()
})

// jsdom implementa o elemento <dialog> (incluindo o atributo/propriedade `open`), mas não os
// métodos imperativos showModal()/close() — sem isso, qualquer componente baseado em <dialog>
// (ConfirmDialog, ProjectFormDialog) quebra em teste com "showModal is not a function".
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}
