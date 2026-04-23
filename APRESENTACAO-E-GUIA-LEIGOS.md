# Controle de Impressão — Guia para leigos e material de apresentação

*Texto em linguagem simples, para quem não trabalha com tecnologia. Pode ser usado em reuniões, treinamentos ou slides.*

---

## Em uma frase

É um **site interno** onde a instituição **cadastra impressoras e setores**, **define quantas páginas cada setor pode imprimir por mês**, **acompanha o uso real** (lendo as próprias impressoras pela rede) e **gera relatórios** para a gestão — com **login** para administrador e para gestores de setor.

---

## Qual o problema que resolve?

- Antes: difícil saber **quem imprimiu quanto**, **quando a cota acabou** e **quem autorizou folhas extras**.
- Agora: tudo fica **registrado no mesmo lugar**, com **números atualizados** e **histórico** para prestar contas à direção.

---

## Como funciona, na prática?

1. **Cadastramos** cada impressora (nome, setor, onde fica no setor, endereço na rede) e o **tipo** dela (monocromática, multifuncional mono ou multifuncional color).
2. **Definimos duas camadas de cota**:
   - **Cota por impressora/setor** — por exemplo: “este setor pode usar até 1.000 páginas neste mês nesta impressora”.
   - **Cota geral por tipo (pool contratado com a Simpress)** — o total mensal que a instituição contratou para cada tipo (ex.: 135.000 páginas monocromáticas, 105.500 multifuncional mono, 5.999 color). Toda liberação extra **desconta também desse pool geral**.
3. O sistema **consulta as impressoras automaticamente** (várias vezes ao dia) e **atualiza quantas páginas já foram usadas**.
4. Se a cota **estourar**, o setor pode pedir uma **liberação extra**; o **administrador** registra no sistema **quantas páginas foram liberadas**, o **motivo** e **qual administrador autorizou** (escolhido em lista de usuários, não mais digitado à mão).
5. No **primeiro dia do mês seguinte**, a conta **recomeça do zero** para o novo mês — a cota é sempre **mensal**.
6. **Relatórios** mostram uso por setor, por impressora, por tipo de impressora e por período (mês e, se quiser, semana dentro do mês), com **gráficos e visual profissional** pronto para impressão.

*Observação:* o sistema **não imprime sozinho** nem mexe na fila da impressora; ele **apenas lê informações** que a impressora já oferece na rede e **controla as regras de cota** que vocês cadastraram.

---

## Quem usa o sistema?

| Tipo de usuário | O que faz |
|-----------------|-----------|
| **Administrador** | Cadastra tudo (impressoras, setores, cotas, usuários), libera páginas extras quando necessário, vê o quadro geral da instituição. |
| **Gestor de setor** | Entra com login próprio e vê **somente as impressoras e números do seu setor** (ou dos setores que lhe foram atribuídos). É para **acompanhar**, não para alterar cadastros. |

O login usa **usuário no formato nome.sobrenome** (não é e-mail) e uma **senha** definida pelo administrador.

---

## O que cada tela mostra? (em linguagem simples)

| Tela | Para que serve |
|------|----------------|
| **Login** | Entrada segura no sistema. |
| **Painel (Dashboard)** | Resumo do mês: uso geral, **cards das cotas contratadas por tipo** (pool Mono, Multi Mono e Color com uso, liberado, saldo e % — no mesmo estilo da tela de Cotas), gráficos por setor, impressoras que mais gastaram, alertas de cota e informações de monitoramento. |
| **Impressoras** | Lista das máquinas, setor, link para abrir a página da impressora no navegador, contador de páginas, nível de toner (quando disponível) e **tipo da impressora** (Mono / Multi Mono / Color). |
| **Setores** | Cadastro de setores (nome, responsável). Só administrador. |
| **Cotas** | Limite mensal por impressora (ligado ao setor), barra de uso, registro de liberações e **cards das cotas contratadas por tipo** no topo. Permite **filtrar** a lista clicando no card de um tipo. Administrador pode **editar a cota mensal** de cada impressora direto pelo ícone de lápis e também **ajustar o pool contratado** de cada tipo. |
| **Liberações** | Histórico de quando foram liberadas páginas a mais, quantas, motivo e qual administrador autorizou. Ao registrar uma nova liberação, **o autorizador é escolhido em uma lista suspensa de usuários administrativos** (evita erro de digitação). O modal também mostra **o impacto da liberação no pool geral daquele tipo de impressora** antes de confirmar. |
| **Monitoramento** | Leituras recentes da rede, histórico por impressora, fechamento mensal de contadores. |
| **Alertas** | Central de avisos do sistema: toner acabando, impressora offline, cota estourada. Toca um **aviso sonoro** quando chega alerta novo e tem um **sino no menu** com a contagem de alertas não lidos. |
| **Relatórios** | Números consolidados por período, com **impressão profissional** (cabeçalho com marca, cartões de KPI, gráficos, e a seção “Cotas contratadas por tipo de impressora” incluída automaticamente). Pronto para enviar à direção. |
| **Usuários** | Quem pode entrar no sistema e se é admin ou gestor de quais setores. Só administrador. |

---

## Cotas Gerais por Tipo de Impressora (pool contratado)

Além da cota de cada setor/impressora, existe um **teto contratado com a Simpress** que vale para o parque inteiro, dividido em três “bolsões”:

| Tipo | Pool mensal contratado |
|------|------------------------|
| 🖨️ **Impressora Monocromática** | 135.000 páginas |
| 📠 **Impressora Multifuncional Mono** | 105.500 páginas |
| 🎨 **Impressora Multifuncional Color** | 5.999 páginas |

**Como funciona, na prática:**

- O sistema **classifica cada impressora automaticamente** no seu tipo (pelo número de série da planilha HSE/Simpress; se faltar, pelo modelo).
- Cada card mostra, em tempo real: **uso atual**, **páginas já liberadas**, **saldo restante** e **porcentagem do pool**. A barra fica **verde → amarela → vermelha** conforme se aproxima do teto.
- **Toda liberação extra** registrada em uma impressora **abate também do pool geral** daquele tipo. Antes de confirmar, o modal mostra quanto vai sobrar no pool — e avisa se a liberação vai **ultrapassar o contratado**.
- Os cards aparecem **no Dashboard** (visão rápida), **na tela de Cotas** (com opção de filtrar a lista pela categoria clicada) e **no relatório impresso** (para prestar contas à direção).
- O **administrador pode reajustar** o valor do pool contratado, caso a instituição renegocie o contrato.

Isso resolve o problema de “cada setor achar que tem sua cota separada e, no fim do mês, a soma passar do que a instituição realmente contratou”. Agora dá para enxergar **os dois lados ao mesmo tempo**: o limite do setor e o limite global.

---

## Sistema de Alertas (aviso inteligente)

O sistema **vigia as impressoras sozinho** e **avisa na hora** quando algo fica fora do normal.

**O que ele avisa:**

| Gravidade | Quando dispara |
|-----------|----------------|
| 🔴 **Crítico** | Toner abaixo de 10% · Impressora sem responder há mais de 15 min · Cota do setor estourada |
| 🟡 **Aviso**   | Toner abaixo de 25% · Cota do setor a 90% do limite · Impressora reportando erro/atolamento de papel |

**Como o aviso chega:**

1. **Sino no canto do menu** com um número vermelho mostrando quantos alertas estão pendentes.  
2. **Bolha flutuante** (toast) que aparece no canto da tela em qualquer página quando surge um alerta novo.  
3. **Aviso sonoro** curto — **3 beeps agudos** para alertas críticos e **2 beeps médios** para avisos. Se não quiser ouvir, basta clicar no ícone de **alto-falante** dentro do sino para silenciar (a escolha fica salva naquele navegador).
4. **Página "Alertas"** com histórico completo, filtros (pendente / resolvido / por tipo / por gravidade), botão para **reconhecer** alertas e um painel de **teste dos sons** para você ouvir na hora como cada tipo soa.

**Pontos importantes:**

- O sistema **não repete o mesmo aviso** toda hora. Se o toner está crítico, é **um alerta só** — enquanto o problema existir, nada novo é criado.  
- Quando o problema **some sozinho** (toner trocado, impressora volta online, vira o mês), o alerta é **resolvido automaticamente** e sai do contador.  
- **Gestor vê só os alertas dos setores dele.** Administrador vê tudo.
- Histórico fica guardado por **90 dias** e depois é limpo sozinho.

---

## Perguntas que costumam aparecer

**Os dados somem se o computador desligar?**  
Não. As informações ficam salvas em um **arquivo de banco de dados** no servidor. Ao ligar de novo, tudo continua de onde parou.

**Preciso instalar programa em cada PC?**  
Não. Basta abrir o **navegador** (Chrome, Edge, etc.) e acessar o endereço do sistema na rede da instituição.

**O gestor do setor X vê o setor Y?**  
Não, a menos que o administrador tenha **liberado mais de um setor** para aquele gestor. Por padrão, cada um vê só o que é da sua área.

**O que é “liberação extra”?**  
É quando a cota do mês já foi usada (ou vai estourar) e a gestão **autoriza mais páginas**. Isso fica **anotado no sistema** para o relatório daquele mês (com quem autorizou escolhido em lista de usuários); **no mês seguinte** a conta volta ao limite normal, sem “acumular” a liberação para sempre.

**A liberação extra “some” do pool da Simpress?**  
**Sim.** Toda liberação desconta do pool contratado daquele tipo de impressora (Mono, Multi Mono ou Color). O modal de liberação mostra o saldo antes e depois — se for ultrapassar o contratado, aparece um aviso em vermelho.

**E se eu precisar mudar a cota mensal de uma impressora?**  
O administrador tem um **ícone de lápis** na tela de Cotas ao lado de cada linha. Basta clicar, digitar o novo limite e salvar. O mesmo vale para o **pool contratado** de cada tipo, caso o contrato mude.

---

## Sugestão de roteiro para apresentação (10–15 minutos)

1. **Problema** — falta de visibilidade e controle sobre impressão por setor e sobre o pool contratado com a Simpress.  
2. **Solução** — um painel único: cadastro, cotas por setor **e por pool contratado**, leitura automática, relatórios profissionais.  
3. **Demonstração rápida** — login → dashboard (cards dos pools) → uma impressora → cotas (editar, liberar, filtrar por tipo) → relatório impresso.  
4. **Perfis** — admin x gestor (transparência sem dar acesso a tudo para todos).  
5. **Benefício para a direção** — números confiáveis, histórico, padronização e **acompanhamento do contrato com a Simpress mês a mês**.  
6. **Próximos passos** — treinamento de gestores, revisão anual das cotas e dos pools.

---

## Frases prontas para slides (copiar e colar)

- *Controle de impressão centralizado: cotas mensais, uso real e relatórios.*  
- *Cada setor enxerga só o que é dele; a gestão vê o todo.*  
- *As impressoras são consultadas automaticamente — menos planilha manual.*  
- *Liberações extras ficam registradas, com motivo e autorizador escolhido em lista.*  
- *Dados persistentes: o histórico continua após reiniciar o servidor.*  
- *Alertas inteligentes com aviso sonoro avisam na hora sobre toner baixo, impressora offline e cota estourada.*  
- *Cotas em duas camadas: por setor e por pool contratado com a Simpress (Mono, Multi Mono e Color).*  
- *Dashboard e relatório impresso mostram o quanto já foi consumido de cada pool e quanto sobrou.*  
- *Relatórios profissionais prontos para impressão: cabeçalho com marca, KPIs, gráficos e cotas contratadas.*

---

## Onde está a documentação técnica?

Quem for **implantar ou dar manutenção** no servidor pode usar o arquivo **`DOCUMENTACAO.md`** na mesma pasta do projeto (terminologia de API, instalação, segurança).

---

*Última atualização: inclusão das cotas gerais por tipo de impressora (pool contratado Simpress), edição de cota por impressora, seleção de autorizador em lista, reflexo dos pools no Dashboard e relatório impresso profissional.*
