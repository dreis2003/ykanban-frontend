import { describe, expect, it } from 'vitest'
import { getInitials } from './initials'

describe('getInitials', () => {
  it('usa a primeira letra de nome e sobrenome', () => {
    expect(getInitials('Daniel Reis')).toBe('DR')
  })

  it('ignora nomes do meio, usando apenas primeiro e último', () => {
    expect(getInitials('Daniel Mitsuo Reis')).toBe('DR')
  })

  it('usa só a primeira letra para nome simples', () => {
    expect(getInitials('Maria')).toBe('M')
  })

  it('normaliza espaços extras', () => {
    expect(getInitials('  Ana   Silva  ')).toBe('AS')
  })

  it('retorna string vazia para nome vazio', () => {
    expect(getInitials('')).toBe('')
    expect(getInitials('   ')).toBe('')
  })

  it('sempre retorna maiúsculas', () => {
    expect(getInitials('daniel reis')).toBe('DR')
  })
})
