import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { textosVoz } from './voz'

describe('voz do treino (aluno x coach no presencial)', () => {
  it('aluno: fala com ele; coach: fala do aluno pelo primeiro nome', () => {
    const aluno = textosVoz({ coach: false, nome: 'Ana Souza' })
    const coach = textosVoz({ coach: true, nome: 'Ana Souza' })
    expect(aluno.rirPergunta).toBe('Ainda faria quantas?')
    expect(coach.rirPergunta).toBe('Ana ainda faria quantas?')
    expect(aluno.dorBotao).toBe('Senti dor')
    expect(coach.dorBotao).toBe('Ana sentiu dor')
    expect(coach.checkinTitulo).toBe('Como Ana está?')
    expect(coach.checkinPergunta('sono', 'Como você dormiu esta noite?')).toBe('Como Ana dormiu esta noite?')
    expect(coach.checkinPergunta('cansaco', 'Cansaço ou dor muscular no corpo')).toBe('Cansaço ou dor muscular no corpo')
    expect(aluno.checkinPergunta('sono', 'Como você dormiu esta noite?')).toBe('Como você dormiu esta noite?')
    expect(coach.pesoPergunta).toBe('Qual é o peso de Ana (kg)?')
  })
  it('nenhum texto do coach fala com "você"/"seu coach" (é 3ª pessoa)', () => {
    const coach = textosVoz({ coach: true, nome: 'Ana' })
    const textos = Object.values(coach).map((v) => (typeof v === 'function' ? (v as (...a: unknown[]) => string)('parar', 'x') : v))
    for (const t of textos) expect(t).not.toMatch(/\b(você|seu coach|seu treino|estou|senti)\b/i)
  })
  it('Hoje.tsx só esconde do coach a trava da agenda', () => {
    const fonte = readFileSync('src/features/aluno/Hoje.tsx', 'utf8')
    const linhas = fonte.split('\n').filter((l) => /(?<!!)!coach\b/.test(l)).map((l) => l.trim())
    expect(linhas.filter((l) => !l.startsWith('const travada = (w: number, t?: number) => !coach && travado('))).toEqual([])
  })
  it('sem nome: usa "O aluno" em vez de ficar em branco', () => {
    const t = textosVoz({ coach: true, nome: '' })
    expect(t.dorBotao).toBe('O aluno sentiu dor')
    expect(t.rirRotulo).toBe('Quantas repetições o aluno ainda faria?')
  })
})

// Regra do Victor (24/11/2026): toda função/botão do aluno aparece também no presencial do coach.
// Só estes `!coach` continuam no Treino: são travas e esperas do app do aluno, não funções.
// Para um recurso novo do aluno, use a voz (voz.ts) em vez de escondê-lo do coach.
describe('presencial não esconde funções do aluno', () => {
  it('Treino.tsx só tem os !coach permitidos', () => {
    const fonte = readFileSync('src/features/aluno/Treino.tsx', 'utf8')
    const linhas = fonte.split('\n').filter((l) => /(?<!!)!coach\b/.test(l)).map((l) => l.trim())
    const permitidos = [
      'const pedirAnamnese = !coach && an.travar', // trava do "Iniciar" (o coach vê o aviso em 3ª pessoa)
      'if (carregando || carregandoReg || (!coach && an.carregando))', // espera da anamnese
      'if (!coach && semanaAtual(', // ciclo que ainda não começou
      'const travado = !coach && !comecou && !realizado', // aluno só anota depois de iniciar
      'if (!coach && !comecou && !realizado && travadoAgenda(', // trava da agenda
    ]
    const novos = linhas.filter((l) => !permitidos.some((p) => l.startsWith(p)))
    expect(novos, 'função do aluno escondida do coach: use a voz (voz.ts) em vez de !coach').toEqual([])
  })
})
