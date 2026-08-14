import { describe, expect, it } from 'vitest'
import { getContrastTextColor } from './contrastColor'

describe('getContrastTextColor', () => {
  it('returns black text for white background', () => {
    expect(getContrastTextColor('#FFFFFF')).toBe('#000000')
  })

  it('returns white text for black background', () => {
    expect(getContrastTextColor('#000000')).toBe('#ffffff')
  })

  it('returns white text for a mid-brightness blue background', () => {
    expect(getContrastTextColor('#3B82F6')).toBe('#ffffff')
  })

  it('returns black text for a bright yellow background', () => {
    expect(getContrastTextColor('#FDE047')).toBe('#000000')
  })

  it('returns white text for a saturated red background', () => {
    expect(getContrastTextColor('#EF4444')).toBe('#ffffff')
  })

  it('returns black text for a light gray background', () => {
    expect(getContrastTextColor('#E5E7EB')).toBe('#000000')
  })

  it('is case-insensitive with respect to hex digits', () => {
    expect(getContrastTextColor('#3b82f6')).toBe(getContrastTextColor('#3B82F6'))
  })
})
