# Game of Thrones / A Song of Ice and Fire (SIFRP) - Foundry VTT Module

Este é um módulo robusto de automação para o Foundry Virtual Tabletop, projetado especificamente para o RPG **Guerra dos Tronos (A Song of Ice and Fire Roleplaying)**. Ele traz suporte amplo para mecanização de Fichas de Personagem, Fichas de Feudo (Casas) e traz um inovador **Sistema Tático de Guerra (Warfare)**.

## 🚀 Funcionalidades Principais

### 1. Sistema de Guerra e Exércitos (Warfare Automation)
- **Cálculo de Comandantes:** Interliga o General e o Subcomandante de uma tropa lendo rigorosamente seus atributos de *Guerra*, *Comando*, *Estratégia* e *Tática*. As pontuações são somadas formando um **Orçamento de Manobra (Budget)** preciso para distribuir os ganhos em seus respectivos atributos (Movimento, Atletismo, Percepção, Disciplina, etc).
- **Adequação de Orçamento em Tempo Real:** O módulo fornece botões rápidos de `+` e `-` para distribuir os pontos diretamente pela Ficha das Tropas, e sinaliza instantaneamente quantos pontos de manobra sobraram na conta dos comandantes.
- **Atributos Dinâmicos e Rígidos pelas Tropas:** Se a tropa for alterada para "Piqueiros", "Cavalaria" ou "Cerco", os valores bases atrelados matematicamente são limpos e trocados na retaguarda, impedindo sujeira de dados ou erros caso a unidade mude sua função no futuro de uma campanha.
- **Cartões de Dano (Chat Cards) e Botão Único:** A Tropa que atacar gera um teste complexo avaliando Treinamento, Tática de Luta e Lesões. Nos acertos por Graus, o Master Cart fornece o "Click-to-Apply" já considerando o subtrair letal da Armadura local do alvo.

### 2. Multiplicadores de Escala Absolutos
- Tratamento automático de tamanho: **Pelotão (10), Unidade (100), Batalhão (500), Legião (1000)**.
- Se o conhecimento do general em guerra (`Guerra < Requisito`) for insuficiente para guiar aquele batalhão, as penalidades se aplicam sem perdoar na lógica do jogo.

### 3. Ficha de Feudo (House Management)
- Administração de Casas e Feudos (Riqueza, Terra, População, Defesa) de modo conciso.
- Permite construir melhorias e controlar as engrenagens dos personagens jogadores de forma centralizada.

### 4. Battle HUD (Atalho Tático)
- Alternância rápida com um botão flutuante para mostrar de forma expressa (Sem abrir e travar Foundry inteiro) a integridade de seus soldados.
- Sincronização impecável com os números da Ficha Oficial (Armadura, Orçamento, Saúde ou Penalidades e Manobras válidas).

## 📥 Instalação (Manual)
1. Clone ou baixe as pastas deste repositório da branch `master`.
2. Mova a pasta extraída (`got-character-sheet`) diretamente para o diretório de módulos do seu Foundry VTT:
   `Data/modules/got-character-sheet`
3. Entre no Foundry, inicie seu Mundo e, na aba respectiva de Configurações, ligue o pacote respectivo de "Guerra dos Tronos".

## 🛠 Arquitetura & Tecnologias
Construído totalmente no fluxo do FoundryVTT sob o formato `.hbs` para os esqueletos gráficos (templating) e `.js` (Classes) para as pontes operacionais de `ActorSheets`. 

O código roda desfrutando ao máximo as engrenagens `Roll()` e de validações via String NFD permitindo que especializações como "Estratégia" ou "estrategia", salvas com variações de caractere pelo usuário, mantenham a precisão do parse e ignorem falhas e espaços indevidos das customizações.

---
**Autor:** VonDerLitch
**Licença:** MIT
