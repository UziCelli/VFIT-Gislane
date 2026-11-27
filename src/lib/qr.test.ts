import { describe, expect, it } from 'vitest'
import { qrDataUrl } from './qr'

describe('qrDataUrl', () => {
  it('gera um SVG em data URL', () => {
    const url = qrDataUrl('otpauth://totp/VFITCOACH:a@b.com?secret=ABC&issuer=VFITCOACH')
    expect(url.startsWith('data:image/svg+xml')).toBe(true)
    expect(decodeURIComponent(url)).toContain('<svg')
  })

  it('reaproveita o QR do mesmo texto e refaz o de outro', () => {
    const a = qrDataUrl('pix-teste-1')
    expect(qrDataUrl('pix-teste-1')).toBe(a)
    expect(qrDataUrl('pix-teste-2')).not.toBe(a)
    for (let i = 0; i < 20; i++) qrDataUrl(`pix-enche-${i}`)
    expect(decodeURIComponent(qrDataUrl('pix-teste-1'))).toContain('<svg')
  })
})
