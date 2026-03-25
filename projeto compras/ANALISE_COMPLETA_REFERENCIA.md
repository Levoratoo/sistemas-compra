# Analise Completa de Referencia - Projeto de Compras, Licitacao, Implantacao e Operacao

## 1. Objetivo deste documento

Este documento consolida a leitura dos arquivos existentes na pasta `projeto compras` para servir como referencia futura de negocio, modelagem e extracao de dados.

O objetivo nao e implementar nada aqui. O objetivo e registrar de forma organizada:

- como os documentos se relacionam;
- como a empresa monta a proposta da licitacao;
- como essa proposta vira plano de implantacao;
- como a implantacao vira controle operacional de compras;
- como os mesmos dados continuam sendo usados durante a vigencia do contrato, incluindo reposicoes periodicas.

Este material deve ser tratado como uma base de conhecimento para futuras etapas do sistema.

## 2. Arquivos analisados

### 2.1. Estrutura

Pasta principal analisada:

- `projeto compras/`

Arquivos encontrados:

- `projeto compras/Planilha de controle base de exemplo/2025-11-26- Controle de compras.xlsx`
- `projeto compras/Planilha de controle base de exemplo/Planilha IDEAS EBSERH Julio Muller 90030 - diligencia 2 (1).xlsx`
- `projeto compras/Tipos de dados/Mapa de Implantacao_Lauro Muller (1) (2).pdf`
- `projeto compras/Tipos de dados/SEI_SEDE - 50001701 - Termo de Referencia - SEI.pdf`
- `projeto compras/Tipos de dados/SEI_SEDE - 50093139 - Edital - SEI.pdf`

### 2.2. Leitura geral do conjunto

Os arquivos nao representam uma unica etapa do negocio. Eles cobrem o ciclo quase inteiro de um contrato:

1. licitacao e regras do processo;
2. composicao da proposta economica;
3. implantacao apos ganhar o pregao;
4. compras operacionais reais;
5. entregas, pagamentos e reposicoes ao longo do contrato.

Em outras palavras: nao se trata de um sistema de "compras" isolado nem de um sistema de "licitacao" isolado. O dominio correto e gestao completa do contrato operacional.

## 3. Resumo executivo do caso principal encontrado

O conjunto mais consistente de documentos analisados se refere ao Hospital Universitario Julio Muller da Universidade Federal do Mato Grosso, filial da EBSERH.

### 3.1. Dados centrais recorrentes

- Processo: `23532.000274/2024-71`
- Pregao: `90.030/2025`
- Orgao: `Hospital Universitario Julio Muller - HUJM-UFMT / EBSERH`
- Cidade/UF: `Cuiaba/MT`
- Quantidade de postos: `77`
- Quantidade de colaboradores: `94`
- Vigencia base: `12 meses`
- Possibilidade de prorrogacao: `ate 5 anos`
- Valor anual encontrado na proposta/mapa: `R$ 4.930.053,02`

### 3.2. Datas importantes encontradas

No edital:

- sessao publica: `27/06/2025`
- horario: `09:00`

No Termo de Referencia:

- previsao de inicio da execucao dos servicos: `30/08/2025`

No mapa de implantacao:

- previsao de assinatura do contrato: `05/11/2025`
- previsao de inicio: `10/11/2025`
- texto explicando que a empresa ja venceu o pregao e o processo esta em homologacao

Importante: ha diferenca entre datas entre os documentos. Isso indica que o sistema futuro precisa armazenar a origem de cada data por documento, em vez de assumir uma unica data "correta" sem revisao.

## 4. Papel de cada arquivo no processo de negocio

### 4.1. Edital

Papel principal:

- documento convocatorio;
- define objeto, criterio, data da sessao, regras de participacao e anexos;
- amarra formalmente que a proposta deve conter planilha de custos e formacao de precos.

### 4.2. Termo de Referencia

Papel principal:

- detalha tecnicamente o contrato;
- define cargos, quantitativos, obrigacoes operacionais, exigencias de uniformes, EPI, equipamentos, treinamento, preposto, ponto eletronico e fiscalizacao.

### 4.3. Planilha de composicao de custos

Papel principal:

- transforma o edital/TR em proposta economica;
- calcula custo por cargo, por posto, por profissional e por contrato;
- distribui uniformes, EPI e equipamentos como componentes economicos do contrato;
- serve como base de rubrica e referencia financeira para compras futuras.

### 4.4. Mapa de implantacao

Papel principal:

- pega o contrato ja ganho e organiza a entrada em operacao;
- traduz obrigacoes contratuais em checklist de implantacao;
- organiza documentos, prazos, beneficios, preposto, compras iniciais, ponto, SESMT e prestacao de contas.

### 4.5. Planilha de controle operacional

Papel principal:

- acompanha a execucao real das compras por projeto;
- registra fornecedor, valor real, status de compra, pagamento, entrega e reposicao;
- compara o que estava previsto na rubrica com o que foi de fato comprado;
- vira o controle continuo do contrato.

## 5. Analise detalhada da planilha operacional

Arquivo:

- `2025-11-26- Controle de compras.xlsx`

### 5.1. Abas encontradas

- `Dashboard`
- `Projetos - Controles`
- `Status Geral`
- `Indicadores e Performance Compr`
- `Relatorio mensal Compras`

### 5.2. Visao geral da planilha

Esta e a planilha que mais se parece com o sistema alvo. Ela ja opera em nivel de projeto e item.

Nao e uma planilha de formacao de preco de licitacao. E uma planilha de acompanhamento de execucao.

Ela mostra que o negocio hoje acompanha:

- compras por projeto;
- itens previstos na licitacao;
- fornecedor aprovado;
- numero de GLPI ou processo interno;
- envio para pagamento;
- entrega na unidade;
- reposicao futura;
- status operacional da linha.

### 5.3. Aba `Projetos - Controles`

#### 5.3.1. Papel da aba

E a base transacional principal. Cada linha representa um item de compra vinculado a um projeto/orgao.

#### 5.3.2. Colunas principais identificadas

1. `Orgao`
2. `Classificacao Compra`
3. `Prioridade`
4. `Funcao (oes)`
5. `N Pessoas`
6. `Quantidade a ser comprada`
7. `Rubrica (R$ valor na Licitacao)`
8. `Descricao do Item`
9. `Especificacao do Item`
10. `Tamanho`
11. `Requer CA (Certificado de Aprovacao)`
12. `Status Compras`
13. `Data da assinatura do contrato`
14. `Prazo Edital (para entrega)`
15. `Prazo reposicao (Edital) em dias`
16. `Valor Unitario`
17. `Valor total`
18. `Fornecedor aprovado`
19. `GLPI (numero)`
20. `Data do envio para pagamento`
21. `Data prevista de entrega`
22. `Data da entrega na unidade`
23. `Status demais etapas`
24. `Data Prevista de Reposicao`
25. `Status de Reposicao`
26. `Observacoes`
27. `Competencia`
28. `Numero do contrato`
29. `Taxa administrativa`

#### 5.3.3. Logica de negocio implicita na aba

A estrutura das colunas mostra um fluxo operacional claro:

1. existe um item previsto para o projeto;
2. esse item possui uma rubrica licitada;
3. a equipe vai ao mercado e encontra o valor real;
4. a compra anda por status;
5. o item pode ter entrega e pagamento separados;
6. se houver recorrencia, e calculada uma proxima reposicao.

#### 5.3.4. Calculos relevantes encontrados

- `Valor total = valor unitario x quantidade`
- `Data prevista de reposicao = data da entrega + prazo de reposicao`
- `Status de reposicao` classificado em:
  - `🔴 VENCIDO`
  - `🟠 VENCE EM ATE 30 DIAS`
  - `🟡 VENCE EM ATE 60 DIAS`
  - `🟢 OK`

Exemplo real de formula encontrada:

- `=IF(AND(V3<>"",O3<>""), V3 + O3, "")`
- `=IF(X3="","", IF(TODAY()>X3,"🔴 VENCIDO",IF(X3-TODAY()<=30,"🟠 VENCE EM ATE 30 DIAS",IF(X3-TODAY()<=60,"🟡 VENCE EM ATE 60 DIAS","🟢 OK"))))`

#### 5.3.5. Exemplos reais do projeto HUJM-MT

##### Uniformes

- `Calca jeans`
  - funcao: `RECEPCIONISTA, AUX. DE ARQUIVO, PORTEIRO, DIGITADOR, CONTINUO`
  - pessoas: `79`
  - quantidade: `158`
  - rubrica: `89,90`
  - status: `Produto entregue`
  - prazo de reposicao: `180 dias`
  - proxima reposicao: `05/08/2026`

- `Camisa gola polo`
  - funcao: `RECEPCIONISTA, AUX. DE ARQUIVO, PORTEIRO, DIGITADOR, CONTINUO`
  - quantidade: `138`
  - rubrica: `54,90`
  - valor unitario real: `52,00`
  - valor total real: `7.176,00`
  - fornecedor: `MADIS UNIFORMES`
  - GLPI: `2025148114`
  - status: `Produto entregue`
  - economia calculavel: `138 x 54,90 = 7.576,20`; compra real `7.176,00`; economia `R$ 400,20`

- `Scrub - pijama cirurgico`
  - funcao: `Maqueiro`
  - quantidade: `10`
  - rubrica: `119,90`
  - prazo de reposicao: `180 dias`

- `Camisa social`
  - funcao: `Encarregado`
  - quantidade: `2`
  - rubrica: `90,90`
  - prazo de reposicao: `180 dias`

- `Cinto em couro`
  - funcao: `Encarregado`
  - quantidade: `2`
  - rubrica: `27,90`
  - prazo de reposicao: `180 dias`

- `Cracha`
  - funcao: `todos`
  - pessoas: `94`
  - quantidade: `188`
  - rubrica: `4,50`
  - status: `Entrega parcial`

##### EPI

- `Cinta ergonomica`
  - aparece associada a almoxarife, continuo e maqueiro
  - rubrica: `44,90`
  - prazo de reposicao: `360 dias`

- `Luva latex de procedimento cano medio`
  - prazo de reposicao: `360 dias`

- `Luvas de procedimentos nao-cirurgicos`
  - quantidade: `6.000`
  - rubrica: `0,00`
  - status: `Produto entregue`

- `Mascaras descartaveis`
  - quantidade: `2.000`
  - rubrica: `0,00`

- `Mascaras PFF2`
  - quantidade: `1.000`
  - rubrica: `0,00`

- `Avental descartavel em TNT`
  - quantidade: `2.000`
  - rubrica: `0,00`

- `Toucas descartavel em TNT`
  - quantidade: `2.000`
  - rubrica: `0,00`

##### Equipamentos

- `Aparelhos radios (HT) transmissores`
  - prazo de reposicao: `180 dias`

- `Headset`
  - quantidade: `4`
  - rubrica: `129,90`
  - valor unitario real: `35,39`
  - valor total real: `353,91`
  - fornecedor: `LEBLON TECNOLOGIA E COMPUTADORES (YAKAO)`
  - GLPI: `2025148529`
  - status: `Produto entregue`
  - economia: `4 x 129,90 = 519,60`; compra real `353,91`; economia `R$ 165,69`

- `Carrinho duplo com caixas`
- `Carrinho auxiliar`
- `Maleta de transporte de material biologico`

#### 5.3.6. Status encontrados

Status de compras:

- `Orcamento Concluido`
- `Em orcamento`
- `Em analise`
- `Iniciar orcamento`

Status de etapas:

- `Produto entregue`
- `Aguardando pagamento`
- `Orcamentos em aprovacao (Processos/GLPI)`
- `Aguardando entrega`
- `Entrega parcial`

Status de reposicao:

- `🟢 OK`
- `🔴 VENCIDO`
- `🟠 VENCE EM ATE 30 DIAS`
- alem de alguns erros de planilha como `#REF!`

#### 5.3.7. Como a aba controla custos, licitacao e economia

Campos relevantes para a comparacao:

- `rubrica da licitacao`
- `valor unitario real`
- `valor total real`
- `quantidade`

Logica correta para o sistema futuro:

- valor previsto do item = `quantidade prevista x valor unitario licitado`
- valor realizado do item = `soma das compras reais do item`
- economia = `valor previsto - valor realizado`
- alerta de estouro = quando `valor realizado > valor previsto`

#### 5.3.8. Como a aba controla equipe

A planilha nao controla pessoas nominalmente.

Ela controla equipe de forma indireta, por:

- funcao vinculada ao item;
- quantidade de pessoas relacionadas a funcao;
- quantidade de itens derivada da equipe.

Exemplo:

- `94 colaboradores` geram `188 crachas`
- grupos de funcao geram quantidades de uniforme

#### 5.3.9. Como a aba controla reposicoes

Ela ja possui a logica essencial de reposicao:

- prazo de reposicao em dias;
- ultima entrega;
- proxima reposicao prevista;
- status automatico por proximidade.

Exemplo real HUJM:

- `Camisa gola polo`
  - ultima entrega: `21/01/2026`
  - prazo: `180 dias`
  - proxima reposicao: `20/07/2026`

- `Calca jeans`
  - ultima entrega: `06/02/2026`
  - prazo: `180 dias`
  - proxima reposicao: `05/08/2026`

- `Sapato de seguranca`
  - ultima entrega: `05/01/2026`
  - prazo: `360 dias`
  - proxima reposicao: `31/12/2026`

### 5.4. Aba `Dashboard`

#### 5.4.1. Papel da aba

Agregador executivo por orgao.

#### 5.4.2. O que ela resume

- quantidade geral de produtos;
- total entregue;
- percentual geral entregue;
- consolidacao por projeto;
- indicadores por etapa.

#### 5.4.3. Valores reais encontrados

- total geral de produtos: `24.208`
- total entregue: `22.644`
- percentual geral entregue: aproximadamente `93,54%`

Exemplo de consolidacao:

- `Consamu PR`
  - quantidade total: `4.284`
  - produto entregue: `4.255`
  - percentual entregue: aproximadamente `99,32%`

- `HUJM-MT`
  - quantidade total: `16.707`
  - em orcamento: `94`
  - orcamento concluido: `16.613`
  - produto entregue: `16.425`
  - entrega parcial: `188`
  - percentual entregue: aproximadamente `98,31%`

- `Roraima HU-UFRR`
  - quantidade total: `1.074`
  - em orcamento: `247`
  - produto entregue: `167`
  - percentual entregue: aproximadamente `15,55%`

#### 5.4.4. Observacao tecnica

A aba utiliza formulas modernas equivalentes a `UNIQUE`, `FILTER`, `SORT`, `REGEXMATCH`, indicando que o autor trabalha com logica semelhante a planilhas Google/Excel moderno. Essa estrutura e importante para entender que a planilha foi desenhada como dashboard dinamico sobre uma base unica.

### 5.5. Aba `Status Geral`

#### 5.5.1. Papel da aba

Quadro gerencial de pendencias e saldo financeiro por projeto.

#### 5.5.2. Campos observados

- pendencias por etapa;
- valor gasto;
- orcamento edital;
- rubrica pendente prevista;
- saldo.

#### 5.5.3. Exemplos reais

- `Consamu PR`
  - valor gasto: `12.121,01`
  - orcamento edital: `13.201,01`
  - saldo: `1.080,00`

- `HUJM-MT`
  - valor gasto: `4.443,38`
  - orcamento edital: `4.443,38`
  - saldo: `0`

- `Roraima HU-UFRR`
  - valor gasto: `1.176,40`
  - orcamento edital: `7.877,35`
  - saldo: `6.700,95`

### 5.6. Aba `Indicadores e Performance Compr`

#### 5.6.1. Papel da aba

Controle de planejado x realizado, separado em `com rubrica` e `sem rubrica`.

#### 5.6.2. Uso esperado

Essa aba parece voltada a analise mensal de performance de compras, embora alguns numeros indiquem manutencao manual e possiveis inconsistencias.

### 5.7. Aba `Relatorio mensal Compras`

#### 5.7.1. Papel da aba

Consolidacao mensal por contrato/projeto.

#### 5.7.2. Campos relevantes

- numero do contrato;
- orgao;
- competencia;
- pendencia mes anterior;
- pendencia mes atual;
- orcado previsto;
- orcado realizado;
- quantidade prevista na taxa administrativa;
- valor realizado taxa administrativa;
- valor de itens nao previstos (repactuacao);
- balanco mensal de compras.

#### 5.7.3. Importancia de negocio

Essa aba mostra que:

- a operacao e acompanhada por competencia mensal;
- existe controle de itens nao previstos;
- existe discussao de repactuacao;
- a taxa administrativa tambem faz parte da visao financeira.

## 6. Analise detalhada da planilha de composicao de custos da licitacao

Arquivo:

- `Planilha IDEAS EBSERH Julio Muller 90030 - diligencia 2 (1).xlsx`

### 6.1. Papel da planilha

Esta e a planilha de formacao de preco da licitacao.

Ela nao controla a compra real. Ela controla:

- proposta economica;
- custo de mao de obra por cargo;
- beneficios e encargos;
- insumos necessarios;
- uniformes;
- EPI;
- equipamentos;
- rateio desses componentes no custo por posto.

### 6.2. Abas encontradas

- `Planilha Resumo - Proposta`
- `CONSOLIDADA`
- `Almoxarife - 44H`
- `Almoxarife - 12X36D`
- `Aux. Arq. 44h`
- `Continuo 44h`
- `Continuo - 12X36D`
- `Digitador 30h`
- `Encarregado 44h`
- `Maqueiro 44h`
- `Maqueiro - 12X36D`
- `Maqueiro - 12X36N`
- `Sec. Exec. 44h`
- `Recep. 44h`
- `Porte .44h`
- `Porte. - 12X36D`
- `Porte. - 12X36N`
- `Mem. calculo`
- `Uniformes`
- `EPI`
- `Equipamentos`

### 6.3. Aba `Planilha Resumo - Proposta`

#### 6.3.1. Papel da aba

Resumo final da proposta apresentada pelo licitante.

#### 6.3.2. Dados reais encontrados

- razao social: `INSTITUTO DE DESENVOLVIMENTO, ENSINO E ASSISTENCIA A SAUDE - IDEAS`
- CNPJ: `24.006.302/0004-88`
- responsavel legal: `Victor Augusto Nesi`
- processo: `23532.000274/2024-71`
- pregao: `90030/2025`
- valor mensal da proposta: `R$ 410.837,7516`
- valor anual da proposta: `R$ 4.930.053,019`
- valor para 5 anos: `R$ 24.650.265,09`

#### 6.3.3. Importancia

Esse e o nivel "macro" do contrato. O sistema futuro deve guardar esse valor como referencia contratual global, separado das rubricas de compras.

### 6.4. Aba `CONSOLIDADA`

#### 6.4.1. Papel da aba

Consolida o custo por categoria e transforma o custo unitario de cargo em valor mensal e anual do contrato.

#### 6.4.2. Estrutura

Colunas observadas:

- tipo de servico;
- valor proposto por profissional;
- valor proposto por posto;
- quantidade de postos;
- quantidade de profissionais;
- valor total mensal;
- valor total anual.

#### 6.4.3. Exemplos reais

- `Almoxarife 44h`
  - valor por profissional/posto: `4.041,326617`
  - qtd postos: `7`
  - valor mensal total: `28.289,28632`
  - valor anual: `339.471,4359`

- `Almoxarife 12x36 Diurno`
  - valor por profissional: `3.941,984713`
  - valor por posto: `7.883,969425`
  - qtd postos: `5`
  - qtd profissionais: `10`
  - valor anual: `473.038,1655`

- `Recepcionista 44h`
  - valor por posto: `4.337,480135`
  - postos: `28`
  - profissionais: `28`
  - valor mensal total: `121.449,4438`
  - valor anual: `1.457.393,325`

- `Porteiro 12x36 Noturno`
  - valor por profissional: `4.963,609672`
  - valor por posto: `9.927,219344`
  - postos: `4`
  - profissionais: `8`
  - valor anual: `476.506,5285`

#### 6.4.4. Total geral encontrado

- total de postos: `77`
- total de profissionais: `94`
- valor mensal do servico: `R$ 410.837,7516`
- valor anual: `R$ 4.930.053,019`

#### 6.4.5. Inconsistencia encontrada

A aba `CONSOLIDADA` menciona `COMPLEXO HOSPITALAR UFRJ` e trecho de descricao de `vigilancia`, enquanto o restante do conjunto aponta para HUJM / apoio administrativo.

Interpretacao mais provavel:

- reaproveitamento de template de planilha;
- necessidade obrigatoria de revisao humana em extracao automatica.

### 6.5. Abas de cargos

Cada cargo possui uma aba especifica, com o mesmo modelo economico.

#### 6.5.1. Estrutura comum

Cada aba contem:

1. identificacao do posto;
2. dados complementares;
3. modulo 1 - composicao da remuneracao;
4. modulo 2 - encargos e beneficios;
5. modulo 3 - provisao para rescisao;
6. modulo 4 - custo de reposicao do profissional ausente;
7. modulo 5 - insumos diversos;
8. modulo 6 - custos indiretos, tributos e superavit;
9. quadro-resumo por posto;
10. quadro-resumo por categoria.

#### 6.5.2. Exemplo detalhado: `Almoxarife - 44H`

Dados encontrados:

- categoria: `Almoxarife`
- quantidade de postos: `7`
- CBO: `4141-05`
- salario base: `1.700,09`
- CCT: `MT000110/2025`
- data-base: `01/01/2025`

Modulo 1:

- salario base: `1.700,09`
- gratificacao por assiduidade: `65,80`
- total modulo 1: `1.765,90`

Modulo 2:

- 13o salario: `1/12`
- ferias + adicional: `12,10%`
- RAT x FAP: `0,018918`
- FGTS: `8%`
- transporte: formula baseada em `R$ 4,95 por passagem`
- auxilio refeicao: `R$ 23,76`
- cesta basica: `R$ 164,16`
- programa de controle medico: `R$ 59,00`

Modulo 3:

- aviso previo indenizado;
- incidencia de FGTS;
- multa sobre FGTS;
- aviso previo trabalhado;
- total do modulo.

Modulo 4:

- substituicao por ausencias legais;
- licenca paternidade;
- acidente de trabalho;
- afastamento maternidade;
- custo de reposicao.

Modulo 5:

- uniformes: referencia para aba `Uniformes`
- EPI/EPC: referencia para aba `EPI`
- equipamento de ponto: referencia para aba `Equipamentos`

Modulo 6:

- custos indiretos: `5%`
- superavit: `9,63%`

Resultados:

- valor total por posto: `4.041,326617`
- valor total da categoria: `28.289,28632`

#### 6.5.3. Insight de negocio importante

O modulo 4 confirma algo essencial: o negocio nao trata apenas da compra de material. Ele internaliza no custo do contrato a necessidade de reposicao de mao de obra ausente.

Ou seja: o sistema futuro tambem deve modelar a operacao do contrato e nao apenas compras.

### 6.6. Aba `Mem. calculo`

#### 6.6.1. Papel da aba

Documenta a logica legal e matematica por tras da planilha de composicao.

#### 6.6.2. Regras encontradas

- adicional noturno: formula com horas noturnas convertidas;
- adicional de hora noturna reduzida;
- 13o salario: `1/12`;
- ferias + adicional: `12,10%`;
- FGTS: `8%`;
- INSS: `0` por isencao CEBAS;
- salario educacao: `0` por isencao CEBAS;
- SESI/SESC/SENAI/SENAC/SEBRAE/INCRA: `0` por isencao CEBAS;
- RAT x FAP: `0,018918`.

#### 6.6.3. Importancia

Essa aba e a fonte das regras de negocio financeiras. Ela sera muito util no futuro se o sistema vier a calcular ou validar composicao de custos.

### 6.7. Aba `Uniformes`

#### 6.7.1. Papel da aba

Define kits de uniforme por grupo funcional e sua reposicao semestral.

#### 6.7.2. Grupos encontrados

- recepcionista / auxiliar de documentacao / porteiro / digitador / continuo masculino
- recepcionista / auxiliar de documentacao / porteiro / digitador / continuo feminino
- maqueiro
- encarregado
- demais cargos

#### 6.7.3. Itens reais encontrados

- calca jeans escura: `89,90`
- camisa gola polo: `54,90`
- calcado fechado ou sapato social
- meia branca: `17,90`
- cracha de identificacao: `4,50`
- scrub / pijama cirurgico: `119,90`
- camisa social: `90,90`
- calca social: `79,90`
- cinto em couro: `27,90`

#### 6.7.4. Regras importantes

- varios kits sao explicitamente `a cada 6 meses`
- o mapa reforca que a entrega do uniforme deve ser fisica, nao pode ser substituida por dinheiro

#### 6.7.5. Exemplos de totais

- kit masculino base: total `R$ 295,00`, total mensal `R$ 49,17`
- kit feminino base: total `R$ 305,00`, total mensal `R$ 50,83`
- kit maqueiro: total `R$ 280,10`, total mensal `R$ 46,68`
- kit encarregado: total `R$ 348,90`, total mensal `R$ 58,15`

### 6.8. Aba `EPI`

#### 6.8.1. Papel da aba

Lista EPIs por cargo e lotacao, com quantidade anual e custo mensal por funcionario.

#### 6.8.2. Campos encontrados

- item;
- cargo;
- lotacao;
- material;
- quantidade anual;
- valor unitario;
- valor total;
- valor por funcionario.

#### 6.8.3. Exemplos reais

- almoxarife
  - cinta ergonomica: `44,90`
  - luva de algodao com pigmentos: `12 x 2,99`
  - sapato de seguranca: `2 x 69,90`

- continuo / patrimonio
  - cinta ergonomica
  - luva de algodao
  - sapato de seguranca

- continuo / unidade de suporte operacional
  - luva latex de procedimento cano medio: `24/ano`, `29,90`

- maqueiro / hotelaria hospitalar
  - cinta ergonomica
  - luva latex de procedimento cano medio

#### 6.8.4. Relevancia

Essa aba ja define um modelo de reposicao periodica de EPI, ainda que pela quantidade anual em vez de "evento". O sistema futuro pode transformar isso em regra e agenda.

### 6.9. Aba `Equipamentos`

#### 6.9.1. Papel da aba

Lista equipamentos necessarios para o servico e o respectivo rateio.

#### 6.9.2. Campos encontrados

- equipamento;
- quantidade;
- valor unitario;
- valor total;
- depreciacao anual;
- valor total anual.

#### 6.9.3. Itens reais encontrados

- aparelhos radios HT transmissores: `8 x 59,90`
- carrinho duplo com caixas removiveis: `3 x 499,90`
- carrinho auxiliar em aco inox com cesto: `1 x 1.499,90`
- maleta de transporte de material biologico: `2 x 1.299,90`
- fone de ouvido/headset: `4 x 129,90`

#### 6.9.4. Totais encontrados

- total anual: `R$ 6.598,20`
- total mensal: `R$ 1.099,70`
- numero de profissionais previstos: `94`
- total mensal rateado por profissional: `R$ 11,69893617`

#### 6.9.5. Insight importante

Na planilha de custos, equipamento e tratado como custo rateado da proposta. Na planilha operacional, ele reaparece como compra real individualizada.

Isso significa que o sistema futuro deve guardar:

- item orcado/original;
- criterio de amortizacao/depreciacao;
- compra real executada;
- ciclo de reposicao, quando aplicavel.

## 7. Analise detalhada dos PDFs

### 7.1. Edital

Arquivo:

- `SEI_SEDE - 50093139 - Edital - SEI.pdf`

#### 7.1.1. Tipo de documento

- edital de licitacao eletronica

#### 7.1.2. Informacoes principais extraidas

- processo: `23532.000274/2024-71`
- edital: `Licitacao Eletronica n 90.030/2025`
- objeto: `Contratacao de Servico continuado de Apoio Administrativo`
- criterio de julgamento: `menor preco`
- modo de disputa: `aberto`
- data da sessao publica: `27/06/2025`
- horario: `09:00`
- local: `www.comprasgovernamentais.gov.br`
- UASG: `155019`
- orgao: `EBSERH / Hospital Universitario Julio Muller`

#### 7.1.3. O que o edital exige para a proposta

- valor mensal e anual;
- quantidade;
- descricao do objeto;
- indicacao de CBO;
- indicacao de enquadramento sindical/CCT;
- planilha de custos;
- anexos tecnicos.

#### 7.1.4. Itens de compra inferidos a partir do edital

O edital nao lista linha a linha os insumos extraidos no trecho textual inicial, mas remete explicitamente aos anexos:

- detalhamento dos uniformes;
- detalhamento dos EPIs;
- equipamentos a serem fornecidos pela contratada;
- termo de referencia e planilhas.

Conclusao:

- o edital e a origem formal da obrigacao;
- o detalhamento operacional fica mais claro no TR e nos anexos reaproveitados no mapa.

### 7.2. Termo de Referencia

Arquivo:

- `SEI_SEDE - 50001701 - Termo de Referencia - SEI.pdf`

#### 7.2.1. Tipo de documento

- termo de referencia

#### 7.2.2. Informacoes principais extraidas

- processo: `23532.000274/2024-71`
- orgao: `HUJM-UFMT / EBSERH`
- objeto: servicos continuados de apoio administrativo, logistico e operacional com mao de obra, equipamentos, materiais e insumos
- vigencia: `12 meses`
- prorrogacao: `ate 5 anos`

#### 7.2.3. Cargos e quantitativos dos postos

Tabela encontrada:

- almoxarife 44h: `7 postos / 7 empregados`
- almoxarife 12x36 diurno: `5 postos / 10 empregados`
- auxiliar de arquivo 44h: `6 postos / 6 empregados`
- continuo 44h: `3 postos / 3 empregados`
- continuo 12x36 diurno: `1 posto / 2 empregados`
- digitador 30h: `6 postos / 6 empregados`
- encarregado 44h: `1 posto / 1 empregado`
- maqueiro 44h: `2 postos / 2 empregados`
- maqueiro 12x36 diurno: `1 posto / 2 empregados`
- maqueiro 12x36 noturno: `1 posto / 2 empregados`
- secretario executivo 44h: `1 posto / 1 empregado`
- recepcionista 44h: `28 postos / 28 empregados`
- porteiro 44h: `6 postos / 6 empregados`
- porteiro 12x36 diurno: `5 postos / 10 empregados`
- porteiro 12x36 noturno: `4 postos / 8 empregados`
- totais: `77 postos / 94 empregados`

#### 7.2.4. Lotacoes e locais de atuacao extraidos

Exemplos encontrados:

- almoxarife
  - unidade de abastecimento e controle de estoques
  - almoxarifado central
  - depositos da CAF

- auxiliar de arquivo
  - URAGIA
  - administrativo

- continuo
  - USOP
  - todas as areas do HUJM

- digitador
  - central de digitacao
  - unidade de diagnostico por imagem

- maqueiro
  - hotelaria hospitalar / transporte assistencial

- secretario executivo
  - superintendencia

#### 7.2.5. Obrigacoes operacionais encontradas

- reuniao inicial antes do inicio dos servicos;
- curso de qualificacao profissional;
- treinamento sobre a Carta do SUS em ate `30 dias uteis` do inicio;
- indicacao de `1 preposto`;
- visita tecnica semanal do preposto;
- flexibilidade de horarios conforme fiscalizacao;
- implantacao de ponto eletronico;
- prazo de `15 dias corridos` para instalar registrador de ponto;
- minimo de `2 registradores`;
- relatorios mensais do ponto;
- reserva tecnica;
- substituicao de colaborador inadequado em ate `24h`;
- cobertura de faltas em ate `2h`;
- relatorio mensal de atividades;
- prestacao de contas com comprovacao trabalhista e administrativa.

#### 7.2.6. Itens que geram compras ou fornecimentos

O TR e muito claro ao exigir:

- EPI e EPC;
- uniformes;
- cracha/identificacao;
- treinamentos;
- vale transporte;
- beneficios da norma coletiva;
- insumos;
- equipamentos necessarios a execucao dos servicos;
- registrador de ponto eletronico;
- materiais e equipamentos especificos para maqueiros e continuos.

#### 7.2.7. Regras importantes para o sistema futuro

- ha itens de compra inicial e itens de manutencao continua;
- ha exigencias por cargo e lotacao;
- ha evidencia documental obrigatoria;
- ha forte componente de fiscalizacao contratual;
- a execucao mensal depende de documentos de quitacao e lista de materiais fornecidos.

### 7.3. Mapa de Implantacao

Arquivo:

- `Mapa de Implantacao_Lauro Muller (1) (2).pdf`

#### 7.3.1. Tipo de documento

- mapa de implantacao / plano operacional de entrada

#### 7.3.2. Informacoes principais extraidas

- projeto/orgao: `Hospital Universitario Julio Muller da UFMT`
- cidade/estado: `Cuiaba/MT`
- pregao: `90030/2025`
- previsao de assinatura: `05/11/2025`
- previsao de inicio: `10/11/2025`
- colaboradores: `94`
- CCT: `MT000110/2025`
- tempo de contrato: `12 meses`
- valor anual: `R$ 4.930.053,02`

#### 7.3.3. Momento do processo em que ele surge

O mapa informa expressamente que:

- a empresa obteve sucesso no pregao;
- o prazo recursal ja transcorreu;
- o processo esta em homologacao;
- a implantacao precisa comecar antes da assinatura final porque o prazo e curto.

Isso e fundamental para o sistema:

- o projeto muda de fase de `licitacao` para `implantacao` antes do inicio real da operacao.

#### 7.3.4. Secoes principais encontradas

- preposto;
- documentacao para inicio dos trabalhos;
- atendimento;
- DHO e beneficios;
- compras / suprimentos;
- uniforme e crachas;
- EPIs;
- equipamentos;
- ponto/registro de frequencia;
- SESMT;
- laudo para pagamento de insalubridade/periculosidade;
- prestacao de contas;
- disposicoes gerais.

#### 7.3.5. Dados de DHO e beneficios por cargo

O mapa repete de forma operacional os grupos de equipe do contrato:

- `07 almoxarifes 44h`
- `10 almoxarifes 12x36 diurno`
- `06 auxiliares de arquivo 44h`
- `03 continuos 44h`
- `02 continuos 12x36 diurno`
- `06 digitadores 30h`
- `01 encarregado 44h`
- `02 maqueiros 44h`
- `02 maqueiros 12x36 diurno`
- `02 maqueiros 12x36 noturno`
- `01 secretario executivo 44h`
- `28 recepcionistas`
- `06 porteiros`
- `10 porteiros 12x36 diurno`
- `08 porteiros 12x36 noturno`

Beneficios recorrentes encontrados:

- vale transporte com passagem de `R$ 4,95`
- vale alimentacao de `R$ 23,76`
- cesta basica `R$ 164,16`
- programa de controle medico `R$ 59,00`

#### 7.3.6. Regras de implantacao extraidas

- contato com o orgao;
- reuniao de boas-vindas;
- entendimento de necessidade imediata;
- definicao de preposto;
- documentacao para inicio;
- garantia contratual;
- prestacao de contas;
- compras de uniforme e cracha imediatas;
- EPI imediato;
- equipamentos imediatos;
- ponto imediato.

#### 7.3.7. Documentacao para inicio dos trabalhos

Nas paginas visualmente analisadas aparecem exigencias como:

- ASO admissional;
- relacoes de colaboradores aptos para determinadas atividades;
- certificados de capacitacao;
- ficha de controle de EPI;
- ordens de servico em seguranca;
- documentos de SST;
- PGR;
- PCMSO;
- laudos e documentos correlatos.

#### 7.3.8. Regras do preposto

O mapa traz o anexo com as atribuicoes do preposto, incluindo:

- representar a contratada;
- interagir com fiscalizacao;
- ter ciencia do contrato e do plano de fiscalizacao;
- monitorar execucao;
- distribuir orientacoes aos subordinados;
- cuidar de alteracoes de escala e frequencia;
- receber demandas da administracao;
- prestar informacoes com presteza;
- estar presente no HUJM sempre que solicitado.

#### 7.3.9. Tabelas reais de uniformes encontradas no mapa

##### Grupo base masculino a cada 6 meses

- calca jeans escura
- camisa gola polo
- calcado fechado macio
- meia branca
- cracha
- total: `R$ 295,00`
- total mensal: `R$ 49,17`

##### Grupo base feminino a cada 6 meses

- calca jeans escura
- camisa gola polo feminina
- calcado fechado macio
- meia branca
- cracha
- total: `R$ 305,00`
- total mensal: `R$ 50,83`

##### Maqueiro a cada 6 meses

- scrub/pijama cirurgico
- meia
- cracha
- total: `R$ 280,10`
- total mensal: `R$ 46,68`

##### Encarregado a cada 6 meses

- camisa social
- calca social
- sapato social
- meia
- cinto
- cracha
- total: `R$ 348,90`
- total mensal: `R$ 58,15`

#### 7.3.10. Tabelas reais de EPI encontradas no mapa

Itens mostrados por cargo/lotacao:

- cinta ergonomica
- luva de algodao com pigmentos
- sapato de seguranca com biqueira PVC/composite
- luva latex de procedimento cano medio

Itens adicionais citados como possiveis:

- luva de procedimento nao-cirurgico;
- mascaras descartaveis;
- mascaras PFF2;
- avental descartavel em TNT;
- touca descartavel em TNT.

#### 7.3.11. Tabelas reais de equipamentos encontradas no mapa

- radios HT transmissores para comunicacao
- carrinho duplo com caixas removiveis
- carrinho auxiliar inox com cesto
- maleta de transporte de material biologico
- fone de ouvido/headset

Valores consolidados no mapa:

- total anual: `R$ 6.598,20`
- total mensal: `R$ 1.099,70`
- profissionais previstos: `94`
- total mensal rateado por profissional: `R$ 11,70`

#### 7.3.12. Regras adicionais encontradas

- `05 jovens aprendizes`
- `05 PCDs`
- conta vinculada: `sim`
- garantia contratual: `seguro-garantia`

#### 7.3.13. Insight de negocio

O mapa e a ponte perfeita entre o documento juridico e a operacao.

Ele mostra que a implantacao nao e abstrata. Ela e um conjunto de entregas concretas:

- pessoas;
- documentos;
- crachas;
- uniformes;
- EPIs;
- equipamentos;
- ponto;
- garantia;
- compliance;
- prestacao de contas.

## 8. Como os arquivos funcionam juntos

### 8.1. Fluxo documental completo

#### Etapa 1 - Licitacao

O edital e o TR definem:

- objeto;
- regras legais;
- quantitativos de postos;
- anexos obrigatorios;
- exigencias operacionais;
- criterios da proposta.

#### Etapa 2 - Formacao da proposta

A planilha de composicao:

- pega os cargos e quantitativos do TR;
- aplica CCT, salarios, adicionais e beneficios;
- incorpora uniformes, EPI e equipamentos;
- gera custo por cargo;
- consolida valor mensal e anual da proposta.

#### Etapa 3 - Vitoria e implantacao

O mapa de implantacao:

- assume que o pregao foi ganho;
- antecipa a mobilizacao;
- organiza documentacao e tarefas;
- detalha quando cada item precisa estar disponivel;
- torna executavel o que era apenas exigencia contratual.

#### Etapa 4 - Operacao do contrato

A planilha de controle operacional:

- abre um cadastro de itens por projeto;
- reaproveita as rubricas previstas;
- registra compras reais;
- acompanha pagamento, entrega e fornecedor;
- calcula proximas reposicoes.

#### Etapa 5 - Reposicoes e manutencao continua

Os mesmos dados seguem vivos depois do inicio:

- uniforme e reposto a cada 6 meses;
- varios EPIs seguem ciclo periodico;
- equipamentos podem ter troca sob demanda ou por regra;
- ha competencia mensal e prestacao de contas recorrente;
- compras fora do previsto podem ocorrer por repactuacao ou necessidade nao prevista.

### 8.2. Encadeamento de dados

#### 8.2.1. Do PDF para a planilha de composicao

Exemplos claros:

- `94 colaboradores` aparece no TR e na consolidada;
- `77 postos` aparece no TR e na consolidada;
- cargos do TR aparecem como abas especificas na planilha;
- obrigacao de fornecer uniforme/EPI/equipamento no TR aparece nas abas `Uniformes`, `EPI` e `Equipamentos`.

#### 8.2.2. Da planilha de composicao para o mapa

Exemplos claros:

- os mesmos cargos e quantitativos aparecem no mapa;
- os mesmos valores de uniforme aparecem no mapa;
- os mesmos EPIs aparecem no mapa;
- os mesmos equipamentos aparecem no mapa;
- o valor anual da proposta aparece no mapa.

#### 8.2.3. Do mapa e composicao para a planilha operacional

Exemplos claros no HUJM:

- `camisa gola polo 54,90`
- `cracha 4,50`
- `cinta ergonomica 44,90`
- `luva latex 29,90`
- `headset 129,90`

Esses itens saem da composicao e do mapa e reaparecem como itens reais de compra.

## 9. Modelo mental do negocio

### 9.1. Entidade central revisada

Para analise de negocio, o projeto/contrato continua sendo o nucleo operacional mais importante. Mas, para arquitetura de produto, o desenho mais correto e separar:

- `Opportunity / Licitation`
- `Project / Contract`

Motivo:

- nem toda licitacao vira contrato ganho;
- uma licitacao pode ser perdida, cancelada, suspensa ou desclassificada;
- a fase de implantacao so existe quando a oportunidade e convertida em contrato/projeto.

Conclusao pratica:

- desenho ideal do produto: separar `Licitation` de `Project`;
- simplificacao aceitavel de MVP: comecar com `Project`, desde que a arquitetura deixe claro que depois podera haver uma entidade anterior de `Opportunity/Licitation`.

### 9.2. Entidades principais do dominio

- oportunidade / licitacao
- projeto / contrato
- documento
- campo extraido e validado
- cargo / posto
- lotacao / setor
- snapshot de custo por cargo
- item orcado
- pedido de compra
- item executado da compra
- fornecedor
- regra de reposicao
- evento de reposicao
- tarefa de implantacao
- alerta operacional
- compliance e prestacao de contas mensais

### 9.3. Visao do fluxo do negocio

#### 9.3.1. Fase de oportunidade / licitacao

Entradas:

- edital
- termo de referencia
- anexos

Saidas:

- proposta economica
- planilha de custos
- definicao de cargos, quantitativos e insumos
- status final da oportunidade:
  - ganha
  - perdida
  - cancelada
  - desclassificada

#### 9.3.2. Conversao em projeto / contrato

Se a oportunidade for ganha:

- nasce o projeto/contrato;
- a licitacao passa a ser historico e referencia;
- a implantacao e liberada;
- as rubricas e itens previstos passam a alimentar a operacao.

#### 9.3.3. Fase de implantacao

Entradas:

- contrato ganho
- mapa de implantacao
- cronograma

Saidas:

- equipe mobilizada
- documentos entregues
- uniformes e crachas comprados
- EPIs comprados
- equipamentos comprados
- ponto instalado
- inicio operacional viabilizado

#### 9.3.4. Fase de operacao continua

Entradas:

- itens previstos
- demandas mensais
- controle de fiscalizacao

Saidas:

- compras executadas
- entregas registradas
- pagamentos acompanhados
- saldo de rubrica
- visao consolidada de economia e estouro

#### 9.3.5. Fase de reposicoes

Entradas:

- data base de contagem
- tipo de gatilho
- regra de calculo
- historico da ultima entrega ou reposicao

Saidas:

- alerta de proxima reposicao
- nova compra
- novo evento de entrega
- recalculo da proxima data

### 9.4. Conclusao de dominio

O negocio e melhor representado como um sistema de gestao de oportunidades licitatorias e contratos operacionais, com cinco camadas integradas:

1. juridica / licitatoria;
2. economica / orcamentaria;
3. conversao de licitacao em contrato;
4. operacional de implantacao;
5. operacional recorrente com compras e reposicoes.

## 10. Proposta de estrutura de sistema

### 10.1. Diretriz de modelagem

Arquitetura recomendada:

- ideal de produto: separar `Licitation` e `Project`;
- MVP simplificado: pode iniciar apenas com `Project`, mas com campos e relacionamentos preparados para futura separacao;
- compra real: modelar cabecalho da compra separado dos itens da compra;
- origem dos dados: toda entidade importada precisa ter rastreabilidade de documento, pagina, aba e celula quando aplicavel;
- reposicao: nao modelar apenas periodicidade fixa; modelar tambem gatilho e regra de contagem.

### 10.2. Entidades nucleo recomendadas

#### `Licitation` ou `Opportunity`

Campos sugeridos:

- id
- nome_oportunidade
- orgao
- unidade
- processo_numero
- pregao_numero
- uasg
- objeto_resumido
- status_oportunidade
- data_sessao_publica
- data_abertura
- data_encerramento
- valor_estimado
- CCT_base
- observacoes
- converted_project_id

Status sugeridos:

- rascunho
- em_analise
- proposta_montagem
- proposta_enviada
- ganha
- perdida
- cancelada
- desclassificada

Origem:

- edital
- TR
- controles internos

#### `Project` ou `Contract`

Campos sugeridos:

- id
- licitation_id
- nome
- orgao
- unidade
- cidade
- estado
- processo_numero
- pregao_numero
- contrato_numero
- uasg
- objeto_resumido
- status_contrato
- status_implantacao
- status_operacao
- data_assinatura_prevista
- data_assinatura_real
- data_inicio_prevista
- data_inicio_real
- vigencia_meses
- prorrogavel_ate_meses
- valor_mensal_contrato
- valor_anual_contrato
- fonte_documental_principal

Origem:

- edital
- TR
- mapa
- planilha de proposta

#### `ProjectDocument`

Campos sugeridos:

- id
- licitation_id
- project_id
- tipo_documento
- nome_original
- caminho_arquivo
- versao
- data_documento
- data_upload
- hash_arquivo
- status_processamento
- paginas
- observacao

Origem:

- todos os documentos

#### `ExtractedField`

Campos sugeridos:

- id
- document_id
- licitation_id
- project_id
- grupo
- campo
- valor_extraido
- valor_normalizado
- pagina
- trecho_fonte
- confianca
- status_revisao
- valor_confirmado

Origem:

- camada de extracao assistida

#### `ProjectRole`

Campos sugeridos:

- id
- licitation_id
- project_id
- cargo
- cbo
- regime_trabalho
- quantidade_postos
- quantidade_empregados_por_posto
- quantidade_total_empregados
- lotacao
- local_atuacao
- jornada_descricao

Origem:

- TR
- mapa
- planilha de custos

#### `RoleCostSnapshot`

Campos sugeridos:

- id
- project_role_id
- salario_base
- adicional_insalubridade
- adicional_noturno
- gratificacao
- modulo1_remuneracao
- modulo2_encargos_beneficios
- modulo3_rescisao
- modulo4_reposicao_ausente
- modulo5_insumos
- modulo6_indiretos_tributos_lucro
- valor_por_profissional
- valor_por_posto
- valor_total_categoria_mensal
- valor_total_categoria_anual
- referencia_documento

Origem:

- planilha de composicao

#### `BudgetItem`

Campos sugeridos:

- id
- licitation_id
- project_id
- categoria_item
- subcategoria_item
- descricao
- especificacao
- grupo_funcional
- lotacao
- unidade_medida
- quantidade_prevista
- valor_unitario_licitado
- valor_total_licitado
- origem_item
- tipo_origem
- source_document_id
- source_sheet_name
- source_cell_ref
- source_page
- source_excerpt
- source_extracted_field_id
- exige_CA
- observacao

Origem:

- planilha de composicao
- mapa
- TR

#### `Supplier`

Campos sugeridos:

- id
- nome
- cnpj
- contato
- telefone
- email
- observacao

#### `PurchaseOrder`

Campos sugeridos:

- id
- project_id
- supplier_id
- numero_interno
- classificacao_compra
- prioridade
- glpi_numero
- data_pedido
- data_envio_pagamento
- valor_total_pedido
- status_compra
- observacao

Origem:

- planilha operacional

#### `PurchaseItemExecution`

Campos sugeridos:

- id
- purchase_order_id
- project_id
- budget_item_id
- quantidade_comprada
- valor_unitario_real
- valor_total_real
- data_prevista_entrega
- data_entrega
- status_etapa
- observacao

Origem:

- planilha operacional

#### `ReplenishmentRule`

Campos sugeridos:

- id
- project_id
- budget_item_id
- trigger_type
- base_date_type
- base_date
- calculation_rule
- periodicity_unit
- periodicidade_dias
- ativo
- observacao

#### `ReplenishmentEvent`

Campos sugeridos:

- id
- project_id
- budget_item_id
- purchase_item_execution_id
- data_base
- data_prevista
- data_realizada
- status
- observacao

#### `ImplementationTask`

Campos sugeridos:

- id
- project_id
- categoria
- titulo
- descricao
- obrigatoria
- prazo_previsto
- data_conclusao
- status
- responsavel
- documento_evidencia

Origem:

- mapa
- TR

#### `ComplianceRequirement`

Campos sugeridos:

- id
- project_id
- categoria
- descricao
- periodicidade
- prazo_inicial
- exige_validade
- observacao

Origem:

- TR
- mapa

#### `ProjectAlert`

Campos sugeridos:

- id
- project_id
- tipo_alerta
- severidade
- titulo
- descricao
- data_referencia
- resolvido

### 10.3. Escopo recomendado de MVP

Para o primeiro corte funcional, priorizar:

- projeto
- documentos
- cargos
- itens orcados
- pedido de compra
- itens executados da compra
- reposicao
- dashboard

Observacao:

- se o MVP precisar ser mais simples ainda, `Licitation` pode ficar para fase seguinte e o cadastro pode comecar em `Project`;
- ainda assim, o desenho do banco deve deixar clara a futura separacao entre oportunidade e contrato.

### 10.4. Itens recomendados para fase 2

Entram depois do nucleo:

- fiscalizacao detalhada
- compliance requirement mais completo
- compliance submission
- prestacao de contas mensal
- monthly accountability
- glosa
- documentacao mensal recorrente
- workflow mais profundo de compliance
- conversao automatizada de licitacao em projeto, se nao entrar no MVP

### 10.5. Relacionamentos principais

- uma licitacao pode gerar zero ou um projeto;
- um projeto tem muitos documentos;
- um projeto tem muitos cargos;
- um projeto tem muitos itens orcados;
- um pedido de compra pertence a um projeto e a um fornecedor;
- um pedido de compra tem muitos itens executados;
- um item orcado pode aparecer em varias execucoes de compra;
- um item orcado pode ter uma regra de reposicao;
- uma regra de reposicao gera muitos eventos de reposicao;
- um projeto tem muitas tarefas de implantacao;
- um projeto pode ter muitos requisitos de compliance;
- um projeto tem muitos alertas.

### 10.6. Separacao conceitual importante

O sistema precisa separar claramente:

- `oportunidade / licitacao`
- `valor global do contrato`
- `custo da composicao por cargo`
- `rubrica prevista do item`
- `pedido de compra`
- `item executado da compra`
- `valor real comprado`

Se essa separacao nao existir, o sistema vai misturar:

- fase comercial/licitatoria com fase contratual;
- custo de mao de obra;
- custo de insumos;
- saldo da rubrica;
- cabecalho da compra com item comprado;
- compra efetiva.

## 11. Estrategia de leitura e extracao dos arquivos

### 11.1. Planilhas Excel

#### 11.1.1. Reconhecimento por tipo de workbook

Sinais para identificar `workbook de composicao de custos`:

- abas `CONSOLIDADA`, `Uniformes`, `EPI`, `Equipamentos`
- abas por cargo
- modulos 1 a 6

Sinais para identificar `workbook de controle operacional`:

- aba `Projetos - Controles`
- colunas de fornecedor, GLPI, status de entrega, reposicao
- abas de dashboard e relatorio mensal

#### 11.1.2. Estrategia de extracao

Extrair:

- nomes de abas;
- cabecalhos;
- formulas originais;
- valores calculados;
- referencias cruzadas entre abas.

Guardar:

- valor bruto;
- valor normalizado;
- formula, quando houver;
- origem da celula.

#### 11.1.3. Ponto de atencao

Ha erros e tipagens ruins nas planilhas:

- numeros de contrato sendo interpretados como data;
- `#REF!`
- `#VALUE!`
- espacos extras;
- nomes de funcoes inconsistentes;
- emojis de status.

O pipeline de extracao deve normalizar, mas nunca esconder a origem.

### 11.2. PDFs

#### 11.2.1. O que extrair automaticamente

Campos candidatos:

- numero do processo;
- numero do pregao;
- orgao;
- cidade/estado;
- datas relevantes;
- valor anual/mensal;
- cargos;
- quantitativos;
- beneficios;
- prazos operacionais;
- obrigacoes;
- listas de uniformes;
- listas de EPI;
- listas de equipamentos.

#### 11.2.2. Tecnica recomendada

Primeira camada:

- parsing textual;
- regex;
- heuristicas por secao;
- dicionarios de cargos;
- dicionarios de itens.

Segunda camada:

- extracao tabular quando possivel;
- leitura de pagina por pagina;
- mapeamento por palavras-chave.

Terceira camada futura:

- OCR para paginas com tabelas/imagens quando o texto vier pobre;
- eventualmente IA, mas como complemento, nao como dependencia obrigatoria.

#### 11.2.3. Validacao assistida

A revisao humana deve confirmar blocos, nao apenas campos isolados.

Blocos recomendados:

- dados mestre do projeto;
- cargos e quantitativos;
- valores de contrato;
- itens de uniforme;
- itens de EPI;
- itens de equipamento;
- tarefas de implantacao;
- obrigacoes de compliance.

### 11.3. Regras de reconciliacao entre fontes

#### Regra 1

Se o mesmo projeto aparecer em varios documentos, comparar:

- processo;
- pregao;
- orgao;
- total de postos;
- total de colaboradores;
- valor anual.

#### Regra 2

Se o nome interno de uma planilha divergir do restante, marcar alerta.

Exemplo real:

- `CONSOLIDADA` com mencao a `UFRJ` e `vigilancia`
- restante do conjunto focado em `HUJM` e `apoio administrativo`

#### Regra 3

Itens de uniforme/EPI/equipamentos devem ser reconciliados entre:

- planilha de composicao;
- mapa de implantacao;
- planilha operacional.

#### Regra 4

Datas devem carregar fonte documental.

Exemplo real:

- TR com inicio em `30/08/2025`
- mapa com inicio em `10/11/2025`

#### Regra 5

O sistema nao deve assumir que rubrica zero significa irrelevancia.

Exemplo real:

- varios EPIs no HUJM aparecem com rubrica `0`, mas existem como compra operacional real.

## 12. Regras de negocio inferidas a partir dos arquivos

### 12.1. Projeto e a unidade central

Na operacao, quase tudo relevante esta vinculado a um projeto/orgao/contrato.

Na camada de produto completa, existe uma etapa anterior de oportunidade/licitacao.

### 12.2. Itens de compra podem nascer de fontes diferentes

Um item pode vir de:

- anexo de uniforme;
- anexo de EPI;
- anexo de equipamento;
- necessidade operacional nao prevista;
- repactuacao;
- exigencia de fiscalizacao.

### 12.3. Reposicao e parte estrutural do contrato

Nao e excecao. Faz parte da operacao normal, especialmente:

- uniforme semestral;
- EPI periodico;
- alguns equipamentos sob ciclo ou sob demanda.

### 12.4. Implantacao e fase propria

A implantacao nao e apenas mudar o status do projeto. Ela possui:

- tarefas;
- prazos;
- dependencias;
- documentos;
- compras obrigatorias iniciais.

### 12.5. Fiscalizacao e prestacao de contas sao parte do produto

O contrato exige:

- relatorios;
- documentacao trabalhista;
- documentos de SST;
- relacao de materiais fornecidos;
- evidencias mensais.

Logo, o sistema futuro deve prever isso no desenho geral.

Mas, em termos de corte de MVP:

- isso pode ficar para fase 2;
- o primeiro corte pode focar no nucleo operacional de projeto, documento, itens, compra real, reposicao e dashboard.

### 12.6. Existem itens acima da rubrica e itens nao previstos

Portanto o sistema precisa aceitar:

- economia positiva;
- estouro de rubrica;
- item sem rubrica;
- item por repactuacao;
- justificativa e rastreabilidade.

## 13. Problemas de qualidade dos dados encontrados

### 13.1. Inconsistencias estruturais

- contratos/pregoes tratados como data em algumas celulas;
- `#REF!` em status de reposicao;
- `#VALUE!` em numero de contrato;
- espacos duplicados;
- funcoes grafadas de formas diferentes;
- emojis nos status.

### 13.2. Inconsistencias documentais

- diferenca de datas entre TR e mapa;
- aba `CONSOLIDADA` com possivel resquicio de outro contrato/template.

### 13.3. Consequencia para o sistema

O sistema nao pode se apoiar em "importacao cega".

Ele precisa de:

- extracao automatica;
- normalizacao;
- reconciliacao;
- aprovacao humana;
- trilha de auditoria.

## 14. Como este documento deve ser usado no futuro

Este documento deve servir como referencia para:

- desenho do banco;
- desenho de fluxo de upload e extracao;
- modelagem de dashboards;
- definicao dos modulos do sistema;
- entendimento das fases do contrato;
- treinamento de assistente interno;
- validacao de futuras implementacoes.

### 14.1. Perguntas-chave que este documento ja responde

- o sistema e de licitacao ou de contrato?  
Resposta: dos dois. O desenho ideal separa `Licitation/Opportunity` de `Project/Contract`, com continuidade operacional apos a conversao.

- qual a entidade central?  
Resposta: no operacional, `project/contract`; no produto completo, o melhor desenho e `licitation -> project`.

- de onde vem a base dos itens de compra?  
Resposta: edital/TR -> planilha de composicao -> mapa -> operacao.

- por que a planilha continua depois que o contrato foi ganho?  
Resposta: porque os itens viram execucao real e depois reposicao periodica.

- por que a modelagem precisa de implantacao?  
Resposta: porque ha checklist, prazo e evidencias antes do inicio operacional.

- por que precisa de operacao continua?  
Resposta: porque ha compras recorrentes, fiscalizacao e prestacao de contas.

## 15. Sintese final

Os arquivos analisados demonstram um processo maduro, ainda que hoje espalhado em planilhas e PDFs.

O fluxo real do negocio e:

1. o edital e o termo de referencia definem a oportunidade / licitacao;
2. a planilha de composicao transforma isso em proposta economica;
3. se a oportunidade for ganha, ela e convertida em projeto / contrato;
4. o mapa de implantacao transforma a vitoria em plano de entrada;
5. a planilha operacional transforma o plano em compra, entrega, pagamento e reposicao;
6. os dados seguem vivos ao longo da vigencia do contrato.

Portanto, qualquer sistema futuro precisa nascer como sistema de gestao completa de licitacoes e contratos operacionais, cobrindo:

- licitacao;
- conversao para contrato;
- composicao;
- implantacao;
- operacao;
- reposicao;
- compliance;
- dashboards.

Se houver necessidade de simplificar o primeiro corte, o MVP pode iniciar em `Project` e deixar `Licitation`, fiscalizacao detalhada e prestacao de contas mensal para fase 2. Mas o desenho estrutural mais consistente, olhando para os arquivos reais, e separar as fases.
