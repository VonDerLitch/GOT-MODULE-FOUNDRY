# Game of Thrones / A Song of Ice and Fire (SIFRP) - Foundry VTT Module

Este é um módulo avançado de automação para o Foundry Virtual Tabletop, projetado especificamente para o RPG **Guerra dos Tronos (A Song of Ice and Fire Roleplaying)**. Ele traz suporte amplo para mecanização de Fichas de Personagem, Fichas de Feudo (Casas) e o inovador **Sistema Tático de Guerra (Warfare)** com regras customizadas de balanceamento.

## 📥 Instalação (Manual)
1. Certifique-se de que o Git está instalado ou baixe o zip do repositório.
2. Navegue até a pasta de dados do seu Foundry VTT: `Data/modules/`.
3. Clone o repositório ou extraia a pasta: 
   ```bash
   git clone https://github.com/VonDerLitch/GOT-MODULE-FOUNDRY.git got-character-sheet
   ```
4. Inicie o Foundry, vá em `Gerenciar Módulos` e ative o **Módulo de Fichas de Guerra dos Tronos**.

---

## ⚔️ Regras de Batalha (Warfare System Rules)
O sistema de combate de exércitos deste módulo foi balanceado com regras específicas que divergem do livro básico para aumentar a tensão e estratégia nas sessões:

### 1. Estado de Fuga e Saúde 0 (Routing)
- Quando uma tropa atinge **0 de Saúde**, ela entra instantaneamente em **Estado de Fuga**.
- **Movimento Obrigatório:** Uma tropa em fuga deve usar todo o seu movimento para se afastar o máximo possível de qualquer unidade inimiga no início de seu turno.
- **Bloqueio de Ações:** Enquanto estiver em fuga, a tropa não pode atacar ou realizar manobras ofensivas.

### 2. O Teste de Reagrupar (Regroup)
- Para recuperar uma tropa em fuga, o Comandante deve usar a ação **Reagrupar**.
- **Custo de Disciplina:** Cada tentativa de reagrupar consome permanentemente **1 ponto de Disciplina** da tropa.
- **Teste de Comando:** É realizado um teste de **Guerra (Comando)** do Comandante.
- **Dificuldade Dinâmica:** A Dificuldade (**CD**) do teste é calculada como `17 - Disciplina Atual` da tropa. Quanto mais disciplinada a tropa, mais fácil é reagrupá-la.
- **Efeito de Sucesso:** Se o teste passar, a Saúde da tropa é restaurada para o máximo, e ela para de fugir.
- **Perda de Turno:** Realizar a tentativa de Reagrupar consome o turno inteiro daquela unidade, independente do resultado do teste.

### 3. Condição de Vitória: O Comandante Supremo
- **O Chefe da Batalha:** Em um campo de batalha com múltiplos exércitos, existe um único Token que representa o **Comandante Principal** (O General de toda a força).
- **Derrota Absoluta:** Se o Comandante Principal for derrotado/morto em combate, a batalha é considerada **perdida** para o seu lado.
- **Fim da Esperança:** Com o Comandante Supremo fora de combate, nenhuma outra tropa sob o seu comando pode realizar o teste de **Reagrupar**. O exército entra em colapso total.

---

## 🚀 Funcionalidades Técnicas

### 1. Automação de Comandantes
- Integração total entre os atributos do General/Subcomandante e a Tropa. O sistema lê as especialidades (Comando, Estratégia, Tática) e as transforma em um **Orçamento de Manobra** para a ficha de tropa.

### 2. Multiplicadores de Escala
- **Cálculo de Dano:** O Dano é automaticamente multiplicado pelo tamanho da unidade (x2 para Unidades, x3 Batalhões, x4 Legiões), validando se o General possui o nível de **Guerra** necessário para gerir tal escala.

### 3. Battle HUD (Atalho Tático)
- Atalho rápido (Keybind customizável) que exibe as estatísticas vitais, movimentos restantes e opções de ataque sem a necessidade de manter a ficha do ator aberta, otimizando o espaço da tela.

### 4. Gestão de Feudos e Casas
- Fichas dedicadas para controle de Riqueza, População, Defesa e Terras, permitindo que os jogadores gerenciem o crescimento de sua nobreza durante o jogo.

---
**Autor:** [VonDerLitch](https://github.com/VonDerLitch)
**Licença:** MIT
