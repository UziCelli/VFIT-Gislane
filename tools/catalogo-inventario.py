#!/usr/bin/env python3
"""Inventário do catálogo atual de exercícios (etapa 1 do épico #255).

Lê src/data/exercicios.json, doisLados.json e isometricos.json e gera
docs/catalogo/inventario-atual.csv com os atributos propostos para cada um dos
exercícios atuais. Não altera o catálogo nem o app: só produz a tabela para o
Celli conferir. Regras por palavra do nome; quando a palavra não decide, a
coluna `duvida` explica e `status` fica `a_confirmar` (nada é chutado).

Uso: python3 tools/catalogo-inventario.py
"""

import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DADOS = RAIZ / 'src' / 'data'
SAIDA = RAIZ / 'docs' / 'catalogo' / 'inventario-atual.csv'

COLUNAS = [
    'id', 'nome_atual', 'nome_proposto', 'status', 'grupo', 'grupos_secundarios', 'movimento_base',
    'equipamento', 'mecanismo_carga', 'lateralidade', 'modo', 'unidade', 'pegada_variacao',
    'convencao_carga', 'duvida',
]

# Rótulo do equipamento no fim do nome proposto (mesmo estilo da lista de exercícios novos).
ROTULO = {
    'halter': 'Halter', 'halteres': 'Halteres', 'barra': 'Barra', 'barra_w': 'Barra W',
    'barra_hexagonal': 'Barra Hexagonal', 'smith': 'Smith', 'polia': 'Polia', 'duas_polias': 'Duas Polias',
    'maquina_seletora': 'Máquina Seletora', 'maquina_articulada': 'Articulado', 'elastico': 'Elástico',
    'anilha': 'Anilha', 'medicine_ball': 'Medicine Ball', 'kettlebell': 'Kettlebell',
}

# Máquinas que já têm nome próprio: o nome não ganha sufixo de equipamento.
MAQUINAS_NOMEADAS = [
    'cadeira extensora', 'cadeira flexora', 'cadeira abdutora', 'cadeira adutora', 'mesa flexora',
    'flexora vertical', 'peck deck', 'leg press', 'agachamento hack', 'agachamento mini-hack',
    'agachamento v squat', 'flexao nordica maquina',
]

MOVIMENTOS = [
    'agachamento', 'leg press', 'terra', 'cadeira extensora', 'cadeira flexora', 'mesa flexora', 'flexora',
    'passada', 'step up', 'afundo', 'avanco', 'retrocesso', 'elevacao pelvica', 'gluteo', 'bulgaro', 'stiff',
    'flexao nordica', 'flexao de joelhos', 'cadeira abdutora', 'cadeira adutora', 'abducao', 'aducao',
    'monster walk', 'prancha', 'supino', 'pull over', 'peck deck', 'crossover', 'crucifixo inverso', 'crucifixo',
    'flexao de bracos', 'puxada', 'remada alta', 'remada', 'barra fixa', 'suspensao', 'panturrilha',
    'abdominal', 'lombar', 'superman', 'perdigueiro', 'canoa', 'pallof', 'dead bug', 'elevacao lateral',
    'elevacao diagonal', 'elevacao frontal', 'manguito', 'desenvolvimento', 'encolhimento', 'rosca punho',
    'rosca', 'supinacao', 'pronacao', 'flexao palmar', 'pegada', 'triceps', 'snatch', 'clean', 'jerk',
    'overhead squat', 'jump', 'bound', 'hurdlehop', 'skip', 'push-up', 'pushup', 'medicine ball',
]


def sem_acento(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()


def tem(n: str, *palavras: str) -> bool:
    return any(re.search(r'\b' + re.escape(p) + r'\b', n) for p in palavras)


def equipamento(n: str, ex_id: str, por_lado: bool, unilateral: bool, alternado: bool):
    """Devolve (equipamento, mecanismo, dúvida). `n` sem acento e minúsculo."""
    if tem(n, 'smith') and tem(n, 'halter'):
        return 'a_confirmar', '', 'Smith com halter: qual equipamento define a carga anotada?'
    if tem(n, 'smith'):
        return 'smith', 'anilhas', ''
    if tem(n, 'barra hexagonal'):
        return 'barra_hexagonal', 'livre', ''
    if 'barra w' in n:
        return 'barra_w', 'livre', ''
    if tem(n, 'articulada', 'articulado'):
        return 'maquina_articulada', 'anilhas', ''
    if tem(n, 'crossover') and not unilateral:
        return 'duas_polias', 'pinos', ''
    if tem(n, 'cabo', 'polia', 'pulley', 'crossover'):
        return 'polia', 'pinos', ''
    if tem(n, 'elastico'):
        return 'elastico', 'elastico', ''
    if tem(n, 'caneleira'):
        return 'outro', 'livre', 'Equipamento caneleira (fica em "outro", como na lista de novos).'
    if tem(n, 'halteres'):
        return 'halteres', 'livre', ''
    if tem(n, 'halter'):
        if unilateral or tem(n, 'concentrada', 'serrote'):
            return 'halter', 'livre', ''
        if alternado:
            return 'halteres', 'livre', ''
        if tem(n, 'goblet') or ex_id == 'agachamento-halter-banco':
            return 'halter', 'livre', 'Confirmar: 1 halter (goblet/segurado no peito)?'
        if por_lado:
            return 'halteres', 'livre', 'Nome diz "Halter", mas a carga é anotada por lado: provável Halteres (2). Confirmar.'
        return 'halter', 'livre', 'Nome diz "Halter": é 1 halter ou 2 (Halteres)? Confirmar.'
    if tem(n, 'anilha'):
        return 'anilha', 'livre', ''
    if tem(n, 'medicine ball', 'medicineball'):
        return 'medicine_ball', 'livre', ''
    if tem(n, 'bola'):
        return 'outro', 'nenhum', 'Bola de adução (fica em "outro").'
    if tem(n, 'cinto'):
        return 'outro', 'livre', 'Cinto de carga (fica em "outro").'
    if tem(n, 'leg press 45', 'pendulo', 'hack', 'mini-hack', 'v squat', 'remada linear 45'):
        return 'maquina_articulada', 'anilhas', ''
    if tem(n, 'maquina', 'guiada', 'cadeira', 'mesa flexora', 'flexora vertical', 'peck deck', 'leg press'):
        if tem(n, 'guiada'):
            return 'maquina_seletora', 'pinos', 'Máquina "guiada": seletora (pinos) ou com anilhas? Confirmar.'
        return 'maquina_seletora', 'pinos', ''
    if tem(n, 'barra fixa', 'paralela', 'espaldar', 'suspensao', 'banco romano') or tem(n, 'triceps banco'):
        return 'peso_do_corpo', 'corporal', ''
    if tem(n, 'barra', 'snatch', 'clean', 'jerk', 'overhead squat', 'supino fechado'):
        return 'barra', 'livre', ''
    if tem(n, 'puxada', 'remada baixa', 'remada sentada'):
        return 'polia', 'pinos', 'Sem equipamento no nome: lido como polia (puxador/remada baixa). Confirmar.'
    if tem(n, 'remada tradicional', 'remada cavalinho'):
        return 'a_confirmar', '', 'Remada sem equipamento no nome: barra livre, máquina seletora ou articulada?'
    if tem(n, 'remada unilateral', 'remada isometrica'):
        return 'a_confirmar', '', 'Remada sem equipamento no nome: halter, polia ou máquina?'
    if tem(n, 'rosca zottman', 'supinacao', 'pronacao', 'farmer'):
        return 'halter', 'livre', ''
    if tem(n, 'triceps coice'):
        return 'a_confirmar', '', 'Tríceps coice sem equipamento no nome: halter ou polia?'
    if tem(n, 'panturrilha em pe unilateral', 'panturrilha sentado unilateral', 'elevacao lateral inclinado',
           'elevacao lateral isometrica', 'rosca isometrica', 'abdominal oblíquo'):
        return 'a_confirmar', '', 'Sem equipamento no nome: qual é?'
    return 'peso_do_corpo', 'corporal', ''


def lateralidade(n: str) -> str:
    if tem(n, 'alternado', 'alternada', 'passada'):
        return 'alternado'
    if tem(n, 'unilateral', 'serrote', 'concentrada', 'bulgaro', 'afundo', 'avanco', 'retrocesso', 'step up',
           'single leg', 'copenhagen', 'prancha lateral', 'lateral hurdlehop', 'lateral jump'):
        return 'unilateral'
    return 'bilateral'


def movimento(n: str) -> str:
    for m in MOVIMENTOS:
        if m in n:
            return m.replace(' ', '_')
    return ''


TIRAR_GERAL = [
    r'\bcom halteres\b', r'\bcom halter\b', r'\bhalteres\b', r'\bhalter\b', r'\bno smith\b', r'\bsmith\b',
    r'\bna polia\b', r'\bno cabo\b', r'\bcabo\b', r'\bm[aá]quina\b', r'\barticulad[ao]\b',
]
# Barra só sai do nome quando ela é o equipamento; na polia, "Barra"/"Corda" é o acessório e fica.
TIRAR_BARRA = [r'\bbarra hexagonal\b', r'\bcom barra\b', r'\bbarra w\b', r'\bbarra\b(?! (reta|v|fixa|paralela|aberta|neutra))']


def compacto(s: str) -> str:
    return re.sub(r'[^a-z0-9]', '', sem_acento(s))


def nome_proposto(nome: str, equip: str, n: str) -> str:
    if equip in ('peso_do_corpo', 'a_confirmar', 'outro') or tem(n, 'smith dual') or tem(n, 'snatch', 'clean', 'jerk', 'jump', 'bound'):
        return nome
    # Máquina que já se chama pelo nome (Leg Press 45, Hack, Cadeira Extensora...): o tipo vira pílula, não sufixo.
    if equip.startswith('maquina') and not tem(n, 'maquina', 'articulada', 'articulado'):
        return nome
    rotulo = ROTULO.get(equip)
    if not rotulo:
        return nome
    # Rótulo já no nome (Elástico, Anilha, Medicine Ball, Barra Reta, Pulley): só arruma, sem repetir.
    ja_tem = compacto(rotulo) in compacto(nome) or (equip == 'polia' and tem(n, 'pulley'))
    if ja_tem and not equip.startswith('maquina') and equip not in ('halter', 'halteres', 'smith', 'polia', 'duas_polias'):
        return nome
    base = nome
    polia_lugar = re.search(r'\b(?:na )?(polia (?:alta|m[eé]dia|baixa))\b', base, re.IGNORECASE)
    if equip == 'polia' and polia_lugar:
        # "na Polia Alta" vira "Polia Alta" e fica como variação; não ganha outro sufixo.
        return re.sub(r'\s+', ' ', re.sub(r'\b(?:no )?cabo\b', '', base.replace(polia_lugar.group(0), polia_lugar.group(1).title()), flags=re.IGNORECASE)).strip()
    for padrao in TIRAR_GERAL + (TIRAR_BARRA if equip.startswith('barra') else []):
        base = re.sub(padrao, '', base, flags=re.IGNORECASE)
    base = re.sub(r'\(\s*\)', '', re.sub(r'\s+', ' ', base)).strip()
    if equip == 'polia' and tem(n, 'pulley'):
        return base
    if equip == 'duas_polias':
        base = re.sub(r'\b(?:no )?crossover\b', 'Crossover', base, flags=re.IGNORECASE).strip()
    if equip == 'barra' and re.search(r'\bbarra\b', base, re.IGNORECASE):
        return base
    return f'{base} {rotulo}'.strip()


def main() -> None:
    grupos = json.loads((DADOS / 'exercicios.json').read_text(encoding='utf-8'))
    dois = set(json.loads((DADOS / 'doisLados.json').read_text(encoding='utf-8')))
    iso = set(json.loads((DADOS / 'isometricos.json').read_text(encoding='utf-8')))
    anat = json.loads((DADOS / 'anatomia.json').read_text(encoding='utf-8'))

    linhas = []
    for g in grupos:
        for ex in g['exercicios']:
            nome, ex_id = ex['nome'], ex['id']
            n = sem_acento(nome)
            lat = lateralidade(n)
            equip, mec, duvida = equipamento(n, ex_id, ex_id in dois, lat == 'unilateral', lat == 'alternado')
            isometrico = ex_id in iso or tem(n, 'isometrica', 'isometrico', 'hold', 'dead hang', 'l-sit')
            modo = 'isometrico' if isometrico else ('dinamico;excentrico' if tem(n, 'flexao nordica') else 'dinamico')
            if equip == 'peso_do_corpo':
                conv = 'corporal'
            elif ex_id in dois:
                conv = 'por_lado'
            else:
                conv = 'total'
            secundarios = ', '.join(anat.get(ex_id, {}).get('secundarios', []))
            var = re.findall(r'\(([^)]*)\)', nome)
            proposto = nome_proposto(nome, equip, n)
            status = 'a_confirmar' if duvida or equip == 'a_confirmar' else ('igual' if proposto == nome else 'renomear')
            linhas.append({
                'id': ex_id, 'nome_atual': nome, 'nome_proposto': proposto, 'status': status, 'grupo': g['grupo'],
                'grupos_secundarios': secundarios, 'movimento_base': movimento(n), 'equipamento': equip,
                'mecanismo_carga': mec, 'lateralidade': lat, 'modo': modo,
                'unidade': 'tempo' if isometrico else 'reps', 'pegada_variacao': '; '.join(var),
                'convencao_carga': conv, 'duvida': duvida,
            })

    # Nomes quase iguais (sem acento, caixa, espaço e plural final) viram dúvida de duplicata.
    chave = defaultdict(list)
    for l in linhas:
        chave[re.sub(r's\b', '', re.sub(r'[^a-z0-9]', '', sem_acento(l['nome_atual'])))].append(l)
    for iguais in chave.values():
        if len(iguais) > 1:
            for l in iguais:
                outros = ', '.join(o['nome_atual'] for o in iguais if o is not l)
                l['duvida'] = (l['duvida'] + ' ' if l['duvida'] else '') + f'Possível duplicata de: {outros}.'
                l['status'] = 'a_confirmar'

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    with SAIDA.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=COLUNAS)
        w.writeheader()
        w.writerows(linhas)

    print(f'{len(linhas)} exercícios → {SAIDA.relative_to(RAIZ)}')
    print('status:', dict(Counter(l['status'] for l in linhas)))
    print('equipamento:', dict(Counter(l['equipamento'] for l in linhas).most_common()))


if __name__ == '__main__':
    main()
