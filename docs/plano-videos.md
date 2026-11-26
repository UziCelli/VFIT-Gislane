# Vídeos no treino (#253, PR #254)

Demonstração geral no cartão, envio da execução pelo aluno, orientação falada do coach e marcações no vídeo.

## O que cada um vê
- **Aluno (cartão do exercício):** "Ver demonstração" abaixo do nome (só se houver vídeo **No ar** na aba Vídeos). "Enviar minha execução" (grava pelo app ou galeria, até 60 s, sem som) com progresso, Cancelar e Retomar; depois "Vídeo enviado · Aguardando análise". "Orientação do coach" (selo "nova") com "Ligue o som" e, se o coach marcou, o vídeo do aluno com as marcações e os momentos marcados. A orientação mais recente do exercício aparece em todo treino que tiver o mesmo exercício.
- **Coach:** cartão "Execuções para analisar" no Início → `#/execucoes` (fila, mais antigas primeiro) → `#/execucao/:id`: assistir, pausar, caneta, ponto, borracha, desfazer, "Salvar marcações", "Gravar orientação" (até 90 s, com microfone). No presencial, "Enviar orientação" em qualquer cartão, mesmo sem envio do aluno.

## Onde fica cada coisa
- **Demonstração:** link do YouTube "não listado" em `videos/{exercicioId}` (aba Vídeos, #252). Player `youtube-nocookie`, mudo e em loop, criado só no toque. Uma leitura por abertura do app (`src/features/videos/Demonstracao.tsx`).
- **Registro do vídeo privado:** `midias/{id}` no Firestore (regras em `firestore.rules`; campos em `docs/mapa.md`).
- **Arquivo:** Worker `push/` (mesmo do descanso), Durable Object `Midia`, um por vídeo, em partes de 1 MiB (`push/src/midia.ts`).
- **App:** `src/lib/midias.ts` (regras puras), `src/lib/envioVideo.ts` (envio, retomada, link), `src/features/videos/` (`VideosDoCartao`, `Gravador`, `PlayerPrivado`, `Execucoes`).

## Contrato do Worker (`/midia/*`, só com `VIDEOS = "1"`)
| Rota | Quem | Corpo | Resposta |
|---|---|---|---|
| `POST /midia/iniciar` | autor do `midias/{id}` (lido no Firestore com o token dele; status `enviando`, bytes iguais) | `{ id, bytes, mime }` | `{ faltam: n[] }`; 409 outro arquivo; 507 teto cheio |
| `PUT /midia/parte?id&n` | autor | bytes da parte (1 MiB; a última menor) | `{ ok }` |
| `POST /midia/concluir` | autor | `{ id }` | marca `pronto` no Firestore (token do autor, hora do servidor) e avisa **uma vez** (coach: "Execução para analisar"; aluno: "Orientação do coach") |
| `POST /midia/link` | quem consegue ler `midias/{id}` (aluno dono ou coach da marca) | `{ id }` | `{ url }` assinado (HMAC), vale 10 min |
| `GET /midia/ver?p&id&exp&sig` | link assinado | — | vídeo com `Range` (até 8 MiB por resposta) |
| `POST /midia/apagar` | autor ou coach | `{ id }` | apaga o arquivo |

Avisos sem nome, link ou miniatura. Tipos novos `video` (coach) e `orientacao` (aluno) ligam/desligam em Conta. `/esquecer` (Limpeza LGPD) apaga os arquivos do aluno; `tools/limpeza-lgpd.mjs` apaga os `midias`.

## Privacidade
- Nada privado vai para link público ou "não listado". O link de tocar é assinado, curto (10 min) e só sai depois de o Firestore confirmar que quem pede pode ler o registro.
- Isolamento entre marcas: cada marca tem o próprio Firebase; no Worker o nome da instância leva o projeto e o link assinado também.
- Envio largado no meio é apagado em 24 h. Vídeo pronto fica **60 dias** (`RETENCAO_DIAS`) e depois o arquivo some; o registro, as marcações e o histórico ficam.

## Custo (zero, sem cartão)
- Firebase Storage exige plano pago (o projeto é Spark): descartado. R2 tem cota grátis, mas a ativação pede forma de pagamento: descartado.
- **Durable Objects SQLite no plano Workers Free:** 5 GB no total da conta, 100 mil linhas gravadas/dia, 100 mil pedidos/dia. Passou do limite = **erro, sem cobrança** ([preços](https://developers.cloudflare.com/durable-objects/platform/pricing/), [limites](https://developers.cloudflare.com/durable-objects/platform/limits/)). Teto próprio de 4 GB (`TETO_TOTAL`): acima dele o envio responde "Espaço de vídeos cheio".
- **Estimativa:** gravado pelo app, ~7 MB por minuto (900 kbit/s). 30 alunos × 4 envios/mês (~5 MB) + 120 orientações (~8 MB) ≈ 1,6 GB/mês; com 60 dias de retenção, ~3,2 GB guardados. Cada envio de 7 MB ≈ 10 pedidos e ~20 linhas gravadas; cada vez que toca ≈ 2 pedidos. Tráfego de saída do Worker não é cobrado.
- **Para não passar do grátis:** o Worker fica no plano Free (sem cartão, não há como cobrar). Se a conta Cloudflare um dia virar paga, revisar antes `TETO_TOTAL` e `RETENCAO_DIAS`.

## Ligar (só com autorização do Victor)
0. Atualizar a Política de Privacidade (vídeo do aluno guardado na Cloudflare por 60 dias) e decidir se pede novo aceite (`VERSAO_PRIVACIDADE`).
1. `push/wrangler.toml`: `VIDEOS = "1"` (publica pelo `push.yml`).
2. `.env.production` das marcas: `VITE_VIDEOS_PRIVADOS=1`.
Desligado, as rotas respondem 404 e nada aparece no app (a demonstração do YouTube funciona sempre).
