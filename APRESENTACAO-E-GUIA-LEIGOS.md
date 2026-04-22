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

1. **Cadastramos** cada impressora (nome, setor, onde fica no setor, endereço na rede).
2. **Definimos a cota** — por exemplo: “este setor pode usar até 1.000 páginas neste mês nesta impressora”.
3. O sistema **consulta as impressoras automaticamente** (várias vezes ao dia) e **atualiza quantas páginas já foram usadas**.
4. Se a cota **estourar**, o setor pode pedir uma **liberação extra**; o **administrador** registra no sistema **quantas páginas foram liberadas e o motivo**.
5. No **primeiro dia do mês seguinte**, a conta **recomeça do zero** para o novo mês — a cota é sempre **mensal**.
6. **Relatórios** mostram uso por setor, por impressora e por período (mês e, se quiser, semana dentro do mês).

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
| **Painel (Dashboard)** | Resumo do mês: uso geral, gráficos por setor, impressoras que mais gastaram, alertas de cota e informações de monitoramento. |
| **Impressoras** | Lista das máprias, setor, link para abrir a página da impressora no navegador, contador de páginas e nível de toner (quando disponível). |
| **Setores** | Cadastro de setores (nome, responsável). Só administrador. |
| **Cotas** | Limite mensal por impressora (ligado ao setor da impressora), barra de uso e registro de liberações extras. |
| **Liberações** | Histórico de quando foram liberadas páginas a mais, quantas, motivo e quem autorizou. |
| **Monitoramento** | Leituras recentes da rede, histórico por impressora, fechamento mensal de contadores. |
| **Alertas** | Central de avisos do sistema: toner acabando, impressora offline, cota estourada. Toca um **aviso sonoro** quando chega alerta novo e tem um **sino no menu** com a contagem de alertas não lidos. |
| **Relatórios** | Números consolidados para enviar à direção ou analisar tendências. |
| **Usuários** | Quem pode entrar no sistema e se é admin ou gestor de quais setores. Só administrador. |

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
É quando a cota do mês já foi usada (ou vai estourar) e a gestão **autoriza mais páginas**. Isso fica **anotado no sistema** para o relatório daquele mês; **no mês seguinte** a conta volta ao limite normal, sem “acumular” a liberação para sempre.

---

## Sugestão de roteiro para apresentação (10–15 minutos)

1. **Problema** — falta de visibilidade e controle sobre impressão por setor.  
2. **Solução** — um painel único: cadastro, cotas, leitura automática, relatórios.  
3. **Demonstração rápida** — login → dashboard → uma impressora → cotas → relatório.  
4. **Perfis** — admin x gestor (transparência sem dar acesso a tudo para todos).  
5. **Benefício para a direção** — números confiáveis, histórico, padronização.  
6. **Próximos passos** — treinamento de gestores, revisão anual das cotas.

---

## Frases prontas para slides (copiar e colar)

- *Controle de impressão centralizado: cotas mensais, uso real e relatórios.*  
- *Cada setor enxerga só o que é dele; a gestão vê o todo.*  
- *As impressoras são consultadas automaticamente — menos planilha manual.*  
- *Liberações extras ficam registradas, com motivo e responsável.*  
- *Dados persistentes: o histórico continua após reiniciar o servidor.*  
- *Alertas inteligentes com aviso sonoro avisam na hora sobre toner baixo, impressora offline e cota estourada.*

---

## Onde está a documentação técnica?

Quem for **implantar ou dar manutenção** no servidor pode usar o arquivo **`DOCUMENTACAO.md`** na mesma pasta do projeto (terminologia de API, instalação, segurança).

---

*Última atualização: documento voltado à comunicação com equipes não técnicas e apresentações institucionais.*
