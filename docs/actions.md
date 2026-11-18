# Fila do GitHub Actions

Todos os workflows versionados usam o grupo `repository-workflows`, com
`cancel-in-progress: false` e `queue: max`. O GitHub executa um workflow por
vez no repositório e atende os pendentes na ordem de entrada no grupo.
Repositórios diferentes têm filas independentes. Jobs dentro de um mesmo
workflow podem continuar em paralelo.

A fila aceita até 100 execuções pendentes; acima disso, o GitHub cancela as
novas entradas. Execuções criadas com YAML antigo e workflows gerados pelo
GitHub (por exemplo, Dependabot) não recebem essa configuração automaticamente.
Novos arquivos de workflow precisam declarar o mesmo grupo. A fila não elimina
execuções de CI de commits diferentes, não evita conflitos entre agentes e não
substitui revisão de YAML antes do envio.

No app, o conector é disparado por `workflow_run` depois de `Publicar`
terminar com sucesso na main do próprio repositório, inclusive quando apenas
arquivos fora dos antigos filtros de caminho mudam. Ele usa o mesmo commit
publicado e recusa versão ultrapassada. Não aguarda outro workflow com a fila
ocupada. A execução manual exige o app e as regras desse commit já publicados;
se não estiverem, falha imediatamente e deve ser repetida após a publicação.
O identificador BUILD_ID corresponde ao commit do app publicado.

Referência: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#concurrency
