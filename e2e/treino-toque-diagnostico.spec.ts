import { expect, test } from '@playwright/test'
import { criarAluno, criarCoach, criarMeso, hojeSaoPaulo, limparEmuladores } from './seed'

type Marca = { pointerStart?: number; pointerCapture?: number; pointerTimingDelay?: number; clickStart?: number; clickCapture?: number; clickToDom?: number; pointerToDom?: number; clickDuration?: number; clickTimingDelay?: number }
type Sonda = { armada: boolean; marca: Marca | null }
const p = (v: number[], q: number) => [...v].sort((a,b)=>a-b)[Math.ceil(v.length*q)-1] ?? null
const resumir = (v: number[]) => ({ n: v.length, p50: p(v,0.5), p95: p(v,0.95) })
const dados = Array.from({ length: 10 }, (_,i)=>({slotId:'ex'+i,nome:[
  'Supino Reto Barra','Agachamento Livre','Remada Curvada Barra','Puxada Frontal','Elevação Lateral',
  'Cadeira Extensora','Leg Press 45','Rosca Direta Barra','Tríceps Polia','Levantamento Terra',
][i]!}))
test('diagnóstico opt-in: toque no treino, 1/2 alunos, descanso off/on', async ({browser}, info) => {
  test.skip(process.env.PERF_TOQUE!=='1','diagnóstico sob demanda; não é um gate de tempo no CI')
  test.setTimeout(240_000)
  // seed.ts aponta exclusivamente ao projeto demo-forca no loopback.
  const criar = async (nome:string) => {
    const alunoId=await criarAluno(nome, 'perf237-'+nome.split(' ')[0].toLowerCase()+'@teste.com','senha123',80)
    const w={w1:[10,10,10,10]}
    const mesoId=await criarMeso({alunoId,nome:'Meso Fictício',frequencia:1,semanas:1,inicio:hojeSaoPaulo(),
      pausaS:300,divisao:{t1:dados},progressao:{principais:w,auxiliares:w}})
    return {alunoId,mesoId}
  }
  const resultados = []
  // Optional inverse order reduces risk that one build always runs the warm scenario last.
  const casos = [[1,false],[1,true],[2,false],[2,true]] as const
  for (const [alunos, descanso] of (process.env.PERF_INVERTER==='1'?[...casos].reverse():casos)){
    // Cada cenário começa sem sessões ou cargas do anterior.
    await limparEmuladores()
    await criarCoach('Coach Fictício', 'perf237-coach@teste.com', 'senha123')
    const a = await criar('Alfa Fictício')
    if (alunos === 2) await criar('Beta Fictício')
    const context=await browser.newContext({
      baseURL:'http://127.0.0.1:5173',viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce',
      // No service worker or real push endpoint in a synthetic run.
      serviceWorkers:'block',
    })
    await context.route('**/*', async rota => {
      const destino = new URL(rota.request().url())
      if (destino.hostname !== '127.0.0.1' || !['5173', '8080', '9099'].includes(destino.port)) return rota.abort()
      await rota.continue()
    })
    try {
      const page=await context.newPage()
      await page.addInitScript(()=>{
        localStorage.setItem('forca-novidades-pc','2')
        localStorage.setItem('forca-descanso-som','0')
        const s:Sonda={armada:false,marca:null}
        Object.assign(window,{sonda237:s})
        const medido=(e:Event)=>s.armada && e.isTrusted && e.target instanceof Element && e.target.closest('[data-toque237]')
        document.addEventListener('pointerdown',e=>{
          if(!medido(e)) return
          s.marca={pointerStart:e.timeStamp,pointerCapture:performance.now()-e.timeStamp}
        },true)
        document.addEventListener('click', e=>{
          if(!medido(e))return
          s.armada=false
          // Difference from browser event timestamp, not merely a timestamp taken in the handler.
          const marca=s.marca??={}
          marca.clickStart=e.timeStamp
          marca.clickCapture=performance.now()-e.timeStamp
          const cartao = e.target instanceof Element ? e.target.closest('[data-treino-cartao]') : null
          if (!cartao) return
          const o=new MutationObserver(()=>{
            if (!cartao.querySelector('textarea[aria-label="Anotação de Supino Reto Barra"]'))return
            const agora=performance.now()
            marca.clickToDom=agora-e.timeStamp
            if(marca.pointerStart!=null) marca.pointerToDom=agora-marca.pointerStart
            o.disconnect()
          })
          o.observe(cartao,{childList:true,subtree:true})
          setTimeout(()=>o.disconnect(),1500)
        },true)
        if (PerformanceObserver.supportedEntryTypes.includes('event'))
          new PerformanceObserver(list=>{
            for (const raw of list.getEntries()) {
              const e=raw as PerformanceEventTiming
              if(!s.marca) continue
              if(e.name==='pointerdown' && s.marca.pointerStart!=null && Math.abs(e.startTime-s.marca.pointerStart)<2)
                s.marca.pointerTimingDelay=e.processingStart-e.startTime
              if(e.name==='click' && s.marca.clickStart!=null && Math.abs(e.startTime-s.marca.clickStart)<2){
                s.marca.clickTimingDelay=e.processingStart-e.startTime
                s.marca.clickDuration=e.duration
              }
            }
          }).observe({type:'event',durationThreshold:16} as PerformanceObserverInit)
      })
      await page.goto('/')
      await page.getByLabel('E-mail').fill('perf237-coach@teste.com')
      await page.getByLabel('Senha').fill('senha123')
      await page.getByRole('button',{name:'Entrar',exact:true}).click()
      await expect(page.getByRole('heading',{name:'Início'})).toBeVisible()
      await page.goto('/#/aluno/'+a.alunoId+'/presencial/treino/'+a.mesoId+'/1/1')
      const alfa=page.getByRole('region',{name:'Treino de Alfa Fictício'})
      const iniciar=async (nome:string)=>{
        const t=page.getByRole('region',{name:'Treino de '+nome})
        await expect(t.getByRole('heading',{name:'Treino 1'})).toBeVisible()
        const botao=t.getByRole('button',{name:'Iniciar treino',exact:true})
        if(await botao.isVisible()) await botao.click()
        await expect(t.getByText('Treino em andamento')).toBeVisible()
      }
      await iniciar('Alfa Fictício')
      if(alunos===2){
        const bar=page.getByRole('region',{name:'Presencial'})
        await bar.getByRole('button',{name:'Adicionar aluno'}).click()
        await page.getByRole('dialog').getByRole('button',{name:/Beta Fictício/}).click()
        await iniciar('Beta Fictício')
        await page.getByRole('navigation',{name:'Alunos do grupo'}).getByRole('button',{name:'Alfa'}).click()
      }
      const primeiro=alfa.locator('[data-treino-cartao]').first()
      const anotar=primeiro.getByRole('button',{name:'Anotação',exact:true})
      if(descanso){
        await primeiro.getByRole('button',{name:/Descansar \d+ s/}).tap()
        await expect(primeiro.getByRole('button',{name:/Pausar \d+:\d+/})).toBeVisible()
      }
      const cdp=await context.newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
      await page.waitForTimeout(1500)
      const marcas:Marca[]=[]
      for(let i=0;i<35;i++){
        await anotar.evaluate(el=>el.setAttribute('data-toque237',''))
        await page.evaluate(()=>{const s=(window as unknown as {sonda237:Sonda}).sonda237;s.marca=null;s.armada=true})
        await anotar.tap()
        await expect(primeiro.getByRole('textbox',{name:'Anotação de Supino Reto Barra'})).toBeVisible()
        await page.waitForTimeout(110+(i*37)%171)
        const marca=await page.evaluate(()=>(window as unknown as {sonda237:Sonda}).sonda237.marca)
        expect(marca?.pointerToDom).toBeDefined()
        expect(marca?.clickToDom).toBeDefined()
        if(i>=5)marcas.push(marca!)
        await primeiro.getByRole('button',{name:'Cancelar',exact:true}).tap()
        await expect(anotar).toBeVisible()
      }
      const amostras=(k:keyof Marca)=>marcas.flatMap(m=>m[k]==null?[]:[m[k]!])
      resultados.push({alunos,descanso, action:'open exercise note, trusted touch',browser:browser.version(), cpuRate:4,
        pointerToCaptureMs:resumir(amostras('pointerCapture')),
        clickToCaptureMs:resumir(amostras('clickCapture')),
        pointerToDomObservedMs:resumir(amostras('pointerToDom')),
        clickToDomObservedMs:resumir(amostras('clickToDom')),
        eventTimingMinThresholdMs:16,eventTimingTotalTrials:marcas.length,
        // Censored: not equivalent to full-population p50/p95; report count as well.
        capturedPointerInputDelayMs:resumir(amostras('pointerTimingDelay')),
        capturedClickInputDelayMs:resumir(amostras('clickTimingDelay')),
        capturedClickThroughNextPaintMs:resumir(amostras('clickDuration'))})
    } finally {await context.close()}
  }
  const relatorio=JSON.stringify(resultados,null,2)
  console.info(relatorio)
  await info.attach('matriz-toque-237',{body:relatorio,contentType:'application/json'})
})
