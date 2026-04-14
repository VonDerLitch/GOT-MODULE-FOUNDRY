console.log("GOT | got-sheet.js loading (Merged Solution)...");



/**
 * Extend the base ActorSheet to implement the GoT Universal Sheet.
 * This sheet handles Characters, Units, and Feuds using a dynamic layout selector.
 * @extends {ActorSheet}
 */
class GOTActorSheet extends ActorSheet {

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["got", "sheet", "actor"],
            template: "modules/got-character-sheet/templates/actor-sheet.hbs",
            width: 800,
            height: 900,
            submitOnChange: true,
            submitOnClose: true,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "habilidades" }]
        });
    }

    /**
     * Overriding the template path dynamically based on actor data
     */
    get template() {
        const type = this.actor.system.tipo_ficha || "character";
        if (type === "unit") return "modules/got-character-sheet/templates/unit-sheet.hbs";
        if (type === "feud") return "modules/got-character-sheet/templates/feud-sheet.hbs";
        return "modules/got-character-sheet/templates/actor-sheet.hbs";
    }

    /** @override */
    async getData() {
        console.log("GOT | GOTActorSheet.getData called for actor:", this.actor.name);
        console.log("GOT | Sheet options:", this.options);
        const context = await super.getData();
        // Use clone for safety - prevent UI manipulation from leaking to DB assignment
        context.system = foundry.utils.deepClone(this.actor.toObject().system || {});
        if (typeof context.system.biografia !== "string") context.system.biografia = "";

        // Determine layout
        const layout = context.system.tipo_ficha || "character";
        context.isCharacter = layout === "character";
        context.isUnit = layout === "unit";
        context.isFeud = layout === "feud";

        console.log("GOT | Sheet layout determined:", layout);

        if (context.isCharacter) {
            this._prepareItems(context);
            context.familia = await this._prepareRelatives(this.actor.system);
            context.controles = await this._prepareControlled(this.actor.system);
        }
        else if (context.isUnit) {
            this._prepareUnitData(context);
        }
        else if (context.isFeud) {
            this._prepareFeudData(context);
        }

        context.owner = this.actor.isOwner;
        context.limited = this.actor.limited;
        context.observer = this.actor.hasObserverPlayerAccess || game.user.isGM;
        context.editable = this.isEditable;
        context.config = CONFIG.GOT;

        // If 'Limited', hide sensitive tabs and details
        if (context.limited && !game.user.isGM) {
            context.isCharacter = true; // Force basic view
            context.isUnit = false;
            context.isFeud = false;
        }

        console.log("GOT | Sheet Data - Editable:", context.editable, "Owner:", context.owner, "Limited:", context.limited);
        return context;
    }

    /** @override */
    async _onSubmit(event, opts) {
        console.log("GOT | _onSubmit called", event, opts);
        return super._onSubmit(event, opts);
    }

    /** @override */
    async _updateObject(event, formData) {
        console.log("GOT | _updateObject triggered", formData);
        return this.actor.update(formData);
    }

    _prepareUnitData(context) {
        if (!context.system.militar) context.system.militar = foundry.utils.deepClone(CONFIG.GOT.defaultUnitData);
        const m = context.system.militar;

        // Resolve Leaders (Commander & Sub-commander)
        const resolveLeader = (id) => {
            if (!id) return null;
            const actor = game.actors.get(id);
            if (!actor) return null;
            const h = actor.system.habilidades?.guerra || { base: 2, especialidades: {} };
            const specs = h.especialidades || {};
            
            let comando = Number(specs.comando) || 0;
            let tactica = Number(specs["t\u00e1tica"]) || Number(specs.tatica) || 0;
            let estrategia = Number(specs["estrat\u00e9gia"]) || Number(specs.estrategia) || 0;

            for (let [k, v] of Object.entries(specs)) {
                if (typeof v === 'object' && v !== null) v = v.value;
                const normKey = String(k).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                const val = Number(v) || 0;
                
                if (normKey.includes("comando") && comando === 0) comando = val;
                if (normKey.includes("tatica") && tactica === 0) tactica = val;
                if (normKey.includes("estrategia") && estrategia === 0) estrategia = val;
            }
            
            return {
                id: actor.id,
                name: actor.name,
                img: actor.img,
                warfare: Number(h.base) || 2,
                comando,
                estrategia,
                tatica: tactica
            };
        };

        context.comandante = resolveLeader(m.comandante);
        context.subcomandante = resolveLeader(m.subcomandante);

        // 1. Max Size Logic (Based on Commander's Warfare)
        // 2=10, 3=100, 4=500, 5=1000
        const warfare = context.comandante?.warfare || 2;
        const sizeMap = { 2: "PelotÃ£o (10)", 3: "Unidade (100)", 4: "BatalhÃ£o (500)", 5: "LegiÃ£o (1000)" };
        const allowedSizes = [
            { val: "PelotÃ£o (10)", limit: 2 },
            { val: "Unidade (100)", limit: 3 },
            { val: "BatalhÃ£o (500)", limit: 4 },
            { val: "LegiÃ£o (1000)", limit: 5 }
        ];

        context.sizeLimit = sizeMap[warfare] || (warfare > 5 ? "LegiÃ£o (1000)" : "PelotÃ£o (10)");

        // Validation: Is current size allowed?
        const currentSizeObj = allowedSizes.find(s => s.val === m.tamanho);
        const currentLimitReq = currentSizeObj?.limit || 2;
        context.sizeWarning = warfare < currentLimitReq;
        if (context.sizeWarning) {
            context.sizeMsg = `Comandante (Guerra ${warfare}) nÃ£o tem rank suficiente para ${m.tamanho}. Requer Guerra ${currentLimitReq}.`;
        }

        // 2. Armor Calculation (Training x 3) + Manual Bonus
        const trainingLevels = { "Recruta": 1, "Treinado": 2, "Veterano": 3, "Elite": 4 };
        const trainingVal = trainingLevels[m.treinamento] || 1;
        const armaduraBase = trainingVal * 3;
        m.bonus_armadura = m.bonus_armadura || 0;
        m.armadura = armaduraBase + m.bonus_armadura;
        context.armaduraBase = armaduraBase;

        // 3. STAT SYNC & Point Distribution arrays for Unit Sheet
        const pts = m.pontos || {};
        
        const cmdTotal = (context.comandante?.comando || 0) + (context.subcomandante?.comando || 0);
        const strTotal = (context.comandante?.estrategia || 0) + (context.subcomandante?.estrategia || 0);
        const tacTotal = (context.comandante?.tatica || 0) + (context.subcomandante?.tatica || 0);

        const cmdBudget = cmdTotal;
        const strBudget = strTotal;
        const tacBudget = tacTotal;

        const cmdUsed = (Number(pts.luta) || 0) + (Number(pts.disciplina) || 0) + (Number(pts.atletismo) || 0);
        const strUsed = (Number(pts.movimento) || 0) + (Number(pts.pontaria) || 0) + (Number(pts.percepcao) || 0);
        const tacUsed = (Number(pts.agilidade) || 0) + (Number(pts.poder) || 0) + (Number(pts.luta_tac) || 0);

        context.points = {
            cmd: { total: cmdBudget, used: cmdUsed, avail: cmdBudget - cmdUsed },
            str: { total: strBudget, used: strUsed, avail: strBudget - strUsed },
            tac: { total: tacBudget, used: tacUsed, avail: tacBudget - tacUsed }
        };

        const baseStats = CONFIG.GOT?.unitBaseStats?.[m.tipo] || CONFIG.GOT?.unitBaseStats?.["Infantaria"] || {};

        const makeRow = (key, label) => {
            const added = Number(pts[key]) || 0;
            const base = (key === 'luta_tac') ? 0 : (Number(baseStats[key]) || 0);
            return { key, label, base, added, total: base + added };
        };

        context.dist = {
            comando: [
                makeRow("luta", "Luta"),
                makeRow("disciplina", "Disciplina"),
                makeRow("atletismo", "Atletismo")
            ],
            estrategia: [
                makeRow("movimento", "Movimento"),
                makeRow("pontaria", "Pontaria"),
                makeRow("percepcao", "Percepção")
            ],
            tatica: [
                makeRow("agilidade", "Agilidade"),
                makeRow("poder", "Poder"),
                makeRow("luta_tac", "Tática (Luta)")
            ]
        };

        const getFinalStat = (key, defaultVal) => {
            const rowArr = [...context.dist.comando, ...context.dist.estrategia, ...context.dist.tatica];
            const row = rowArr.find(r => r.key === key);
            return row ? row.total : (Number(baseStats[key] || defaultVal) + Number(m.pontos?.[key] || 0));
        };

        const finalStats = {
            luta: getFinalStat("luta", 2),
            disciplina: getFinalStat("disciplina", 2),
            atletismo: getFinalStat("atletismo", 2),
            movimento: getFinalStat("movimento", 1),
            pontaria: getFinalStat("pontaria", 2),
            percepcao: getFinalStat("percepcao", 2),
            agilidade: getFinalStat("agilidade", 2),
            poder: getFinalStat("poder", 2)
        };

        m.luta_final = finalStats.luta;
        m.disciplina_final = finalStats.disciplina;
        m.poder_final = finalStats.poder;
        m.movimento_final = finalStats.movimento;
        m.luta_bonus_from_tactics = (Number(m.pontos?.luta_tac) || 0) * 2;

        // 4. Armor & Defense (Correct Sync)
        // Unit Armor: Training Level x 3 (Recruta=0, Treinado=3, Veterano=6, Elite=9)
        const trLevels = { "recruta": 0, "treinado": 3, "veterano": 6, "elite": 9 };
        const normTr = (m.treinamento || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let arBase = 0;
        if (normTr.includes("treinado")) arBase = 3;
        else if (normTr.includes("veterano")) arBase = 6;
        else if (normTr.includes("elite")) arBase = 9;

        const bonusArm = Number(m.bonus_armadura) || 0;
        m.armadura = arBase + bonusArm;
        context.armaduraBase = arBase;

        const defBase = finalStats.agilidade + finalStats.atletismo + finalStats.percepcao;
        const bonusDef = Number(m.bonus_defesa) || 0;
        context.unitDefense = defBase + bonusDef;
        context.unitDefenseBase = defBase;

        // 5. Health Calculation (Correct Size Bonus)
        const normSize = (m.tamanho || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let sizeBonus = 0;
        if (normSize.includes("unidade")) sizeBonus = 10;
        else if (normSize.includes("batalhao")) sizeBonus = 25;
        else if (normSize.includes("legiao")) sizeBonus = 50;

        const calculatedHealthMax = (finalStats.disciplina * 3) + sizeBonus;
        m.saude = m.saude || { value: 0, max: 0 };
        
        // If the unit has 0 max health in DB, it is newly created. Initialize to full.
        if (m.saude.value === undefined || (m.saude.value === 0 && m.saude.max === 0)) {
            m.saude.value = calculatedHealthMax;
        }
        m.saude.max = calculatedHealthMax;

        if (m.moral === undefined) m.moral = finalStats.disciplina;
        m.movimento_final = finalStats.movimento;

        // --- MANEUVERS ---
        const maneuversMap = {
            "Infantaria": [
                { name: "Manter a Linha", specialty: "Tática", req: 1, bonus: "+3 Defesa", isStance: true, desc: "POSTURA: Ganha +3 de Defesa e Imunidade a Empurrão até o próximo turno." },
                { name: "Parede de Escudos", specialty: "Comando", req: 2, bonus: "+4 Defesa", isStance: true, desc: "POSTURA: Aumenta a defesa em +4, mas Movimento cai para 1." },
                { name: "Avanço Implacável", specialty: "Estratégia", req: 1, bonus: "Empurrar", desc: "AÇÃO: Se acertar o ataque, empurra o alvo 1 quadrado para trás." }
            ],
            "Arqueiros": [
                { name: "Chuva de Flechas", specialty: "Tática", req: 2, bonus: "Ataque em Área", desc: "AÇÃO: Ataque de Pontaria em Área (3x3). Dano (Poder -2)." },
                { name: "Atirar e Recuar", specialty: "Estratégia", req: 1, bonus: "Ataca e Move", desc: "AÇÃO MAIOR: Ataca com Pontaria e ganha um movimento bônus imediato." },
                { name: "Fogo de Supressão", specialty: "Comando", req: 1, bonus: "-1 Disc. Alvo", isStance: true, desc: "POSTURA: Inimigos que terminarem o movimento no alcance sofrem -1 em sua Disciplina se rodarem no teste de Diciplina CD:10." }
            ],
            "Cavalaria": [
                { name: "Carga Devastadora", specialty: "Comando", req: 3, bonus: "Dano Massivo", desc: "AÇÃO: Requer mover 4+ quadrados. Adiciona Poder 4 para o ataque, realizando o imediatamente com a manobra" },
                { name: "Flanquear", specialty: "Tática", req: 2, bonus: "+4D Luta", desc: "AÇÃO: +4D de Luta se o alvo já estiver lutando com outro aliado." },
                { name: "Retirada Tática", specialty: "Estratégia", req: 1, bonus: "Mov. Seguro", desc: "AÇÃO: Move o dobro do seu movimento" }
            ],
            "Piqueiros": [
                { name: "Contra-Carga", specialty: "Tática", req: 2, bonus: "Ataque Primeiro", isStance: true, desc: "POSTURA: Se for atacado por Cavalaria ou Elefante, você ataca primeiro com Dano x2." },
                { name: "Floresta de Piques", specialty: "Comando", req: 1, bonus: "Obstrução", isStance: true, desc: "POSTURA: Inimigos adjacentes não podem se mover sem teste de Agilidade (CD:10)." },
                { name: "Manter Distância", specialty: "Estratégia", req: 2, bonus: "Trava Ataque", desc: "AÇÃO: Se acertar o ataque e o alvo rodar em um teste de agilidade (CD:10), o alvo não pode atacar os Piqueiros corpo-a-corpo no próximo turno." }
            ],
            "Espadachim": [
                { name: "Romper Fileiras", specialty: "Tática", req: 2, bonus: "+Dano p/ Inimigo", desc: "AÇÃO: Se acertar, recebe 3 de poder por cada outro inimigo adjacente a você." },
                { name: "Duelo de Comandantes", specialty: "Comando", req: 2, bonus: "Dano Disciplina", desc: "AÇÃO: Alvo é obrigado a entrar em duelo com, caso contrario perde 2 de diciplina." },
                { name: "Passo de Dança", specialty: "Estratégia", req: 1, bonus: "Atravessar", desc: "AÇÃO: Permite mover-se através de quadrados ocupados por inimigos livremente." }
            ],
            "Armas de Cerco": [
                { name: "Bombardear", specialty: "Estratégia", req: 2, bonus: "Dano vs Estrut.", desc: "AÇÃO: poder 6 contra estruturas (muralhas/portões)." },
                { name: "Fogo de Grifa", specialty: "Tática", req: 2, bonus: "Queimadura", desc: "AÇÃO: Incendeia o alvo. Causa Dano do poder por turno durante 3 turnos (ignora armadura)." },
                { name: "Escada de Assalto", specialty: "Comando", req: 1, bonus: "Escalar", isStance: true, desc: "POSTURA: Unidades aliadas adjacentes escalam muralhas sem testes." }
            ],
            "Elefante": [
                { name: "Pisotear", specialty: "Tática", req: 2, bonus: "Atropelar", desc: "AÇÃO: Move-se através de unidades inimigas, causando Poder +4" },
                { name: "Rugido de Terror", specialty: "Comando", req: 3, bonus: "Fuga em Área", desc: "AÇÃO: Força teste de Disciplina de inimigos adjacentes CD(6). Falha = Fuga imediata." },
                { name: "Torre de Guerra", specialty: "Estratégia", req: 2, bonus: "+2 Alcance", isStance: true, desc: "POSTURA: Arqueiros montados +2D de Pontaria." }
            ],
            "Arqueiros Montados": [
                { name: "Círculo de Cantos", specialty: "Tática", req: 2, bonus: "Ataque Móvel", desc: "AÇÃO: Ataca imediatamente e pode se move rmetade de seu movimento para cima." },
                { name: "Disparo de Assédio", specialty: "Estratégia", req: 2, bonus: "-2D Luta Alvo", desc: "AÇÃO: Ataca com Pontaria. Se acertar, o alvo sofre -2D em seu próximo teste de Luta." },
                { name: "Recuada Defensiva", specialty: "Comando", req: 2, bonus: "Esquiva Móvel", isStance: true, desc: "POSTURA: Se um inimigo terminar o movimento adjacente, você pode recuar 3 quadrados antes dele atacar." }
            ],
            "Naval": [
                { name: "Abordagem", specialty: "Comando", req: 2, bonus: "Assalto", desc: "AÇÃO: Transforma o combate em combate de infantaria dentro dos navios." },
                { name: "Ramagem", specialty: "Tática", req: 1, bonus: "Dano Impacto", desc: "AÇÃO: Dano massivo de impacto frontal contra botes." },
                { name: "Rajada de Setas", specialty: "Estratégia", req: 2, bonus: "+2D Pontaria", desc: "AÇÃO: Usa os conveses superiores para ganhar bônus de altura e precisão." }
            ],
            "Camponês": [
                { name: "Números", specialty: "Comando", req: 1, bonus: "+1D Luta", desc: "Bônus se a unidade for maior que o alvo." },
                { name: "Banda de Guerra", specialty: "Tática", req: 1, bonus: "+2 Defesa", desc: "Bônus se estiver adjacente a outra unidade aliada." },
                { name: "Recuar", specialty: "Estratégia", req: 1, bonus: "Fuga Segura", desc: "Ganha o dobro de movimento para recuar." }
            ]
        };

        const getCombined = (key) => {
            const val = (context.comandante ? (context.comandante[key] || 0) : 0) +
                (context.subcomandante ? (context.subcomandante[key] || 0) : 0);
            return Number(val);
        };

        context.dynamicManeuvers = (maneuversMap[m.tipo] || maneuversMap["Infantaria"]).map(man => {
            const specialtyKey = man.specialty.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const combinedValue = getCombined(specialtyKey);
            return {
                ...man,
                met: combinedValue >= (man.req || 0),
                combinedValue
            };
        });

        if (!m.manobras_custom) m.manobras_custom = [];
        context.customManeuvers = m.manobras_custom.map((man, index) => {
            const specialtyKey = (man.specialty || "Tática").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const combinedValue = getCombined(specialtyKey);
            return {
                ...man,
                index,
                met: combinedValue >= (man.req || 0),
                combinedValue
            };
        });
    }

    _prepareFeudData(context) {
        if (!context.system.dominio) context.system.dominio = foundry.utils.deepClone(CONFIG.GOT.defaultFeudData);
        const d = context.system.dominio;

        const resolveLeader = (id, type) => {
            if (!id) return null;
            const actor = game.actors.get(id);
            if (!actor) return null;
            const hStatus = actor.system.habilidades?.status || { base: 2, especialidades: {} };
            const hWar = actor.system.habilidades?.guerra || { base: 2, especialidades: {} };
            const specsStatus = hStatus.especialidades || {};
            const specsWar = hWar.especialidades || {};

            const findSpec = (specs, name) => {
                const normName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                for (let [key, val] of Object.entries(specs)) {
                    const normKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    if (normKey === normName) return val;
                }
                return 0;
            };

            const leader = {
                id: actor.id,
                name: actor.name,
                img: actor.img,
                gestao: findSpec(specsStatus, "gestao"),
                torneios: findSpec(specsStatus, "torneios"),
                comando: findSpec(specsWar, "comando")
            };

            if (type === "chefe_militar") {
                leader.recrutamento = (leader.comando || 0) * 200;
            }
            return leader;
        };

        context.senhor = resolveLeader(d.senhor, "senhor");
        context.castelao = resolveLeader(d.castelao, "castelao");
        context.chefe_militar = resolveLeader(d.chefe_militar, "chefe_militar");

        context.totalGestao = (context.senhor?.gestao || 0) + (context.castelao?.gestao || 0);
        context.costModifier = 1 - (context.totalGestao * 0.05);

        if (!d.estruturas) d.estruturas = [];
        const typeCounts = {};
        context.builtStructures = d.estruturas.map((s, idx) => {
            const config = foundry.utils.deepClone(CONFIG.GOT.structures[s.id]);
            if (!config) return null;

            typeCounts[s.id] = (typeCounts[s.id] || 0) + 1;
            const instancesOfType = d.estruturas.filter(e => e.id === s.id).length;
            const displayName = instancesOfType > 1 ? `${config.name} ${typeCounts[s.id]}` : config.name;

            const level = s.level || 1;

            const levelBonus = {};
            if (config.bonus) {
                for (let [k, v] of Object.entries(config.bonus)) {
                    levelBonus[k] = v * level;
                }
            }

            const upgradeCost = {};
            let costLabel = "Custos: ";
            if (config.cost) {
                const labels = [];
                for (let [res, amt] of Object.entries(config.cost)) {
                    const total = Math.ceil((amt * (level + 1)) * context.costModifier);
                    upgradeCost[res] = total;
                    labels.push(`${total} ${res.charAt(0).toUpperCase() + res.slice(1)}`);
                }
                costLabel += labels.join(", ");
            } else {
                costLabel = "Grátis";
            }

            return {
                ...config,
                id: s.id,
                index: idx,
                name: displayName,
                level,
                actualBonus: levelBonus,
                upgradeCost: upgradeCost,
                costLabel: costLabel
            };
        }).filter(s => s);

        const castle = context.builtStructures.find(s => s.id === "castelo_principal");
        context.castleLevel = castle?.level || 0;

        context.infraBonus = {
            comida: context.builtStructures.reduce((acc, s) => acc + (s.actualBonus?.comida || 0), 0),
            fortuna: context.builtStructures.reduce((acc, s) => acc + (s.actualBonus?.fortuna || 0) + (s.actualBonus?.lacre || 0), 0),
            poder: context.builtStructures.reduce((acc, s) => acc + (s.actualBonus?.poder || 0), 0),
            ordem: context.builtStructures.reduce((acc, s) => acc + (s.actualBonus?.ordem || 0), 0),
            defesa: context.builtStructures.reduce((acc, s) => acc + (s.actualBonus?.defesa || 0), 0),
            populacao: context.builtStructures.reduce((acc, s) => acc + (s.actualBonus?.populacao || 0), 0),
            soldados: context.builtStructures.reduce((acc, s) => acc + (s.actualBonus?.soldados || 0), 0),
            max_estruturas: context.builtStructures.reduce((acc, s) => acc + (s.actualBonus?.max_estruturas || 0), 0),
            influencia: context.builtStructures.reduce((acc, s) => acc + (s.actualBonus?.influencia || 0), 0),
            vida_muralha: context.builtStructures.reduce((acc, s) => acc + (s.actualBonus?.vida_muralha || 0), 0)
        };

        context.limits = {
            populacao: 50 + context.infraBonus.populacao,
            soldados: 20 + context.infraBonus.soldados,
            estruturas: (d.max_estruturas_base || 5) + context.infraBonus.max_estruturas,
            isPopOk: (d.populacao || 0) <= (50 + context.infraBonus.populacao),
            isSoldiersOk: (d.defesa || 0) <= (20 + context.infraBonus.soldados),
            isStrOk: context.builtStructures.length <= ((d.max_estruturas_base || 5) + context.infraBonus.max_estruturas)
        };

        context.totalOrdem = (d.ordem_publica || 100) + context.infraBonus.ordem;

        const notes = (d.notas || "").toLowerCase();
        context.penalties = { ordem: 0, comida: 0, fortuna: 0 };
        context.activeConditions = {
            dominada: notes.includes("recém dominada") || notes.includes("conquistada recentemente"),
            peste: notes.includes("peste") || notes.includes("doença"),
            saqueada: notes.includes("saqueada") || notes.includes("pilhada") || notes.includes("em ruínas")
        };

        if (context.activeConditions.dominada) {
            context.penalties.ordem -= 20;
            context.penalties.comida -= 5;
            context.penalties.fortuna -= 5;
        }
        if (context.activeConditions.peste) {
            context.penalties.populacao = -100;
            context.penalties.comida -= 10;
        }
        if (context.activeConditions.saqueada) {
            context.penalties.fortuna -= 15;
            context.penalties.ordem -= 15;
        }

        context.totalOrdem += context.penalties.ordem;
        context.infraBonus.comida += context.penalties.comida;
        context.infraBonus.fortuna += context.penalties.fortuna;

        context.maintenance = {
            comida: Math.ceil((d.populacao || 0) / 100)
        };

        context.netYields = {
            fortuna: context.infraBonus.fortuna,
            comida: context.infraBonus.comida - context.maintenance.comida,
            poder: context.infraBonus.poder,
            influencia: context.infraBonus.influencia,
            defesa: context.infraBonus.defesa
        };

        const genTooltip = (res, netValue, entries) => {
            let t = `Saldo Mensal: ${netValue >= 0 ? '+' : ''}${netValue}\n------------------\n`;
            if (entries.length === 0) t += "Sem ganhos estruturais.";
            else t += entries.join("\n");
            return t;
        };

        const resourceEntries = { fortuna: [], comida: [], poder: [], influencia: [], defesa: [] };
        context.builtStructures.forEach(s => {
            for (let [res, val] of Object.entries(s.actualBonus || {})) {
                if (val !== 0 && resourceEntries[res]) {
                    resourceEntries[res].push(`${s.name}: +${val}`);
                }
            }
        });

        context.yieldTooltips = {
            fortuna: genTooltip("fortuna", context.netYields.fortuna, resourceEntries.fortuna),
            poder: genTooltip("poder", context.netYields.poder, resourceEntries.poder),
            influencia: genTooltip("influencia", context.netYields.influencia, resourceEntries.influencia),
            defesa: genTooltip("defesa", context.netYields.defesa, resourceEntries.defesa),
            comida: `Saldo Mensal: ${context.netYields.comida >= 0 ? '+' : ''}${context.netYields.comida}\n------------------\n` +
                (resourceEntries.comida.length > 0 ? resourceEntries.comida.join("\n") + "\n" : "") +
                `Manutenção (População): -${context.maintenance.comida}`
        };
    }

    async _prepareControlled(system) {
        const ids = system.controles || [];
        const units = [];
        const feuds = [];

        for (let id of ids) {
            const a = game.actors.get(id);
            if (!a) continue;
            const data = { id: a.id, name: a.name, img: a.img, type: a.system.tipo_ficha || "character" };
            if (a.system.tipo_ficha === "unit") units.push(data);
            else if (a.system.tipo_ficha === "feud") feuds.push(data);
        }
        return { units, feuds };
    }

    async _prepareRelatives(system) {
        const l = system.linhagem || {};
        const r = system.relacoes || { slots: [] };
        const resolve = async (id) => {
            if (!id) return null;
            const a = game.actors.get(id);
            return a ? { id: a.id, name: a.name, img: a.img } : null;
        };

        const AFFINITIES = {
            "brother": { label: "De Sangue", class: "brother", val: 3 },
            "friend": { label: "Amigo", class: "friend", val: 2 },
            "acquaintance": { label: "Conhecido", class: "acquaintance", val: 1 },
            "dislike": { label: "Antipatia", class: "dislike", val: -1 },
            "enemy": { label: "Inimigo", class: "enemy", val: -2 },
            "hated": { label: "Odiado", class: "hated", val: -3 }
        };

        const slots = [];
        for (let i = 0; i < 12; i++) {
            const slotData = r.slots?.[i] || { id: "", type: "friend" };
            const actor = await resolve(slotData.id);
            slots.push({
                index: i,
                actor: actor,
                type: slotData.type || "friend",
                affinity: AFFINITIES[slotData.type] || AFFINITIES["friend"]
            });
        }

        return {
            pai: await resolve(l.pai),
            mae: await resolve(l.mae),
            conjuge: await resolve(l.conjuge),
            irmaos: await Promise.all((l.irmaos || []).map(resolve)).then(list => list.filter(r => r)),
            filhos: await Promise.all((l.filhos || []).map(resolve)).then(list => list.filter(r => r)),
            slots: slots
        };
    }

    _prepareItems(context) {
        const system = this.actor.system;
        const defaultHabs = CONFIG.GOT.defaultData.habilidades;

        const mergedHabs = {};
        for (let [key, def] of Object.entries(defaultHabs)) {
            const actorHab = system.habilidades?.[key] || {};
            mergedHabs[key] = {
                base: Number(actorHab.base ?? def.base),
                especialidades: {}
            };
            if (def.especialidades) {
                for (let [sKey, sDefVal] of Object.entries(def.especialidades)) {
                    mergedHabs[key].especialidades[sKey] = Number(actorHab.especialidades?.[sKey] ?? sDefVal);
                }
            } else if (def.dialeto !== undefined) {
                mergedHabs[key].dialeto = actorHab.dialeto ?? def.dialeto;
            }
        }
        context.system.habilidades = mergedHabs;

        if (!context.system.info) context.system.info = foundry.utils.deepClone(CONFIG.GOT.defaultData.info);
        if (!context.system.combate_intriga) context.system.combate_intriga = foundry.utils.deepClone(CONFIG.GOT.defaultData.combate_intriga);

        const modifiers = {};
        const specModifiers = {};
        const items = { qualidades: [], defeitos: [], equipamento: [], armas: [], armaduras: [], escudos: [], montarias: [] };
        let totalAR = 0;
        let totalAP = 0;
        let totalBulk = 0;
        let totalShieldBonus = 0;
        let activeMount = null;

        for (let i of this.actor.items) {
            const item = i.toObject(false);
            item.id = i.id;

            if (item.system.type === 'qualidade' || item.system.type === 'defeito') {
                let mods = item.system.modificadores;
                if (!mods || typeof mods !== 'object') mods = [];
                else mods = Array.isArray(mods) ? [...mods] : Object.values(mods);
                if (item.system.modificador_alvo) {
                    mods.push({
                        alvo: item.system.modificador_alvo,
                        especialidade: item.system.modificador_especialidade || "",
                        valor: item.system.modificador_valor || 0
                    });
                }

                for (let mod of mods) {
                    const targetAbility = mod.alvo;
                    const targetSpec = (mod.especialidade || "").toLowerCase().trim();
                    const value = parseInt(mod.valor) || 0;

                    if (targetAbility && value !== 0) {
                        if (targetSpec) {
                            if (!specModifiers[targetAbility]) specModifiers[targetAbility] = {};
                            specModifiers[targetAbility][targetSpec] = (specModifiers[targetAbility][targetSpec] || 0) + value;
                        } else {
                            modifiers[targetAbility] = (modifiers[targetAbility] || 0) + value;
                        }
                    }
                }
                if (item.system.type === 'qualidade') items.qualidades.push(i);
                else items.defeitos.push(i);
            }
            else if (item.system.type === 'arma') {
                const name = (item.name || "").toLowerCase();
                const esp = (item.system.especialidade || "").toLowerCase();

                let atkKey = item.system.habilidade_ataque;
                if (!atkKey) {
                    if (item.system.type_pontaria || esp.includes("arcos") || name.includes("arco") || esp.includes("bestas") || name.includes("besta") || esp.includes("arremesso")) {
                        atkKey = "pontaria";
                    } else {
                        atkKey = "luta";
                    }
                }
                const atkLabel = CONFIG.GOT.habilidades[atkKey] || atkKey;

                const specialtyName = (item.system.especialidade || "").trim();
                let specBonus = 0;
                if (specialtyName) {
                    const normSpec = specialtyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    specBonus = system.habilidades?.[atkKey]?.especialidades?.[normSpec] || 0;
                }

                let attrKey = item.system.atributo_dano;
                if (!attrKey) {
                    if (esp.includes("curtas") || name.includes("adaga") || name.includes("faca") || name.includes("punhal") || name.includes("espada curta")) attrKey = "agilidade";
                    else if (esp.includes("bestas") || name.includes("besta")) attrKey = "agilidade";
                    else if (esp.includes("arcos") || name.includes("arco")) attrKey = "agilidade";
                    else attrKey = "atletismo";
                }
                const attrLabel = attrKey === "nenhum" ? "Nenhum" : (CONFIG.GOT.habilidades[attrKey] || attrKey);
                const totalBonus = (item.system.bonus_dice || 0) + specBonus;
                i.displayTooltip = `(${atkLabel}${totalBonus ? ' +' + totalBonus + 'B' : ''})d6kh[${atkLabel}] | Dano: Base + ${attrLabel}`;

                const layout = this.actor.system.tipo_ficha || "character";
                if (layout !== "unit") {
                    const props = (item.system.propriedades || "").toLowerCase();
                    const desc = (item.system.description || "").toLowerCase();
                    const fullText = `${name} ${props} ${desc}`;

                    if (item.system.bulk) totalBulk += Number(item.system.bulk || 0);

                    if (fullText.includes("defensiva") || fullText.includes("defensive") || fullText.includes("defesa +")) {
                        const match = fullText.match(/(?:defensiva|defensive|defesa)\s*[+]?(\d+)/);
                        if (match) totalShieldBonus += Number(match[1]);
                        else totalShieldBonus += 1;
                    }
                }

                items.armas.push(i);
            }
            else if (item.system.type === 'armadura') {
                if (item.system.uso) {
                    totalAR += Number(item.system.ar || 0);
                    totalAP += Number(item.system.ap || 0);
                    totalBulk += Number(item.system.bulk || 0);
                }
                items.armaduras.push(i);
            }
            else if (item.system.type === 'escudo') {
                if (item.system.uso) {
                    totalShieldBonus += Number(item.system.defesa_bonus || 0);
                    totalBulk += Number(item.system.bulk || 0);
                }
                items.escudos.push(i);
            }
            else if (item.system.type === 'montaria') {
                if (item.system.uso) {
                    activeMount = i;
                }
                items.montarias.push(i);
            }
            else {
                items.equipamento.push(i);
            }
        }

        context.totalMove = activeMount ? Number(activeMount.system.movimento || 4) : Math.max(1, 4 - totalBulk);
        context.sprintValue = context.totalMove * 4;

        context.moveSquares = Math.floor((context.totalMove * 0.91) / 1.5);
        context.sprintSquares = Math.floor((context.sprintValue * 0.91) / 1.5);
        
        if (activeMount) {
            context.activeMount = activeMount;
            context.mountHealthPct = Math.min(100, Math.max(0, (activeMount.system.saude.value / activeMount.system.saude.max) * 100));
            totalShieldBonus += Number(activeMount.system.bonus_defesa || 0);
            
            // Inject Trample Attack
            const trampleAttack = {
                id: "trample",
                name: "Pisotear",
                img: activeMount.img,
                system: {
                    type: "arma",
                    dano: Number(activeMount.system.dano_pisotear || 2),
                    bonus_dice: 0,
                    especialidade: "Montar",
                    habilidade_ataque: "lidar_com_animais",
                    atributo_dano: "nenhum",
                    description: "Manobra de montaria: Atropelar o alvo com os cascos."
                },
                displayTooltip: "(Lidar com Animais)d6kh[Lidar com Animais] | Dano: Base"
            };
            items.armas.push(trampleAttack);
        }

        if (!context.system.info.ouro && context.system.info.ouro !== 0) {
            context.system.info.ouro = 0;
        }

        const wounds = (Number(system.combate_intriga?.lesoes?.value) || 0);
        const injuries = (Number(system.combate_intriga?.ferimentos?.value) || 0);
        const frustration = (Number(system.combate_intriga?.frustracao?.value) || 0);

        const list = [];
        const socialAbilities = ["astucia", "enganacao", "persuasao", "status", "vontade", "conhecimento", "idioma"];

        for (let [key, data] of Object.entries(context.system.habilidades)) {
            if (key === 'idioma' || !CONFIG.GOT.habilidades[key]) continue;
            const bonus = modifiers[key] || 0;
            const base = Number(data.base ?? 2);

            const isSocial = socialAbilities.includes(key);
            let poolPenalty = isSocial ? frustration : wounds;
            const resultPenalty = isSocial ? 0 : injuries;

            if (!isSocial && context.system.combate_intriga.esforco_ativo) {
                poolPenalty = 0;
            }

            let finalDiceCount = Math.max(1, base + bonus - poolPenalty);
            let rollFormula = `${finalDiceCount}d6kh${base}`;
            if (resultPenalty > 0) rollFormula += ` - ${resultPenalty}`;

            if (key === 'agilidade' && totalAP !== 0) {
                rollFormula += ` ${totalAP > 0 ? '+' : ''}${totalAP}`;
            }

            const specialties = [];
            for (let [sKey, sVal] of Object.entries(data.especialidades || {})) {
                const specNameNormal = sKey.toLowerCase().trim();
                const specBonus = (specModifiers[key]?.[specNameNormal] || 0);
                const totalBonusDice = bonus + specBonus;
                const valNum = Number(sVal || 0);
                const totalDice = base + valNum + totalBonusDice;

                let specDiceCount = Math.max(1, totalDice - poolPenalty);

                let specRollFormula = specDiceCount > base ? `${specDiceCount}d6kh${base}` : `${specDiceCount}d6`;
                if (resultPenalty > 0) specRollFormula += ` - ${resultPenalty}`;

                if (key === 'agilidade' && totalAP !== 0) {
                    specRollFormula += ` ${totalAP > 0 ? '+' : ''}${totalAP}`;
                }

                specialties.push({
                    key: sKey,
                    value: valNum,
                    rollFormula: specRollFormula
                });
            }

            list.push({
                key: key,
                label: CONFIG.GOT.habilidades[key] || key,
                base: base,
                bonus: bonus,
                rollFormula: rollFormula,
                especialidades: specialties
            });
        }
        context.habilidadesList = list;

        const res = context.system.habilidades.resistencia?.base || 2;
        const agi = context.system.habilidades.agilidade?.base || 2;
        const atl = context.system.habilidades.atletismo?.base || 2;
        const per = context.system.habilidades.percepcao?.base || 2;
        const ast = context.system.habilidades.astucia?.base || 2;
        const sta = context.system.habilidades.status?.base || 2;
        const von = context.system.habilidades.vontade?.base || 2;

        context.system.combate_intriga.saude.max = res * 3;
        if (context.system.combate_intriga.saude.value === 0 && !context.system.combate_intriga.saude.initialized) {
            context.system.combate_intriga.saude.value = context.system.combate_intriga.saude.max;
            context.system.combate_intriga.saude.initialized = true;
        }
        context.healthPct = Math.min(100, Math.max(0, (context.system.combate_intriga.saude.value / context.system.combate_intriga.saude.max) * 100));
        context.system.combate_intriga.defesa = agi + atl + per + totalShieldBonus + totalAP;

        context.system.combate_intriga.estresse.max = von * 3;
        context.system.combate_intriga.frustracao.max = 5;
        context.system.combate_intriga.defesa_intriga = per + ast + sta;

        if (!context.system.combate_intriga.esforco) context.system.combate_intriga.esforco = { value: res, max: res };
        context.system.combate_intriga.esforco.max = res;
        context.effortPct = Math.min(100, Math.max(0, (context.system.combate_intriga.esforco.value / context.system.combate_intriga.esforco.max) * 100));

        context.totalAR = totalAR;
        context.totalAP = totalAP;

        Object.assign(context, items);
    }

    activateListeners(html) {
        console.log("GOT | GOTActorSheet.activateListeners called");
        super.activateListeners(html);

        const img = html.find('.profile-img');
        img.attr('draggable', true);
        img[0].addEventListener('dragstart', ev => {
            const dragData = {
                type: "Actor",
                uuid: this.actor.uuid
            };
            ev.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        });

        html.on('blur', 'input[name*="habilidades"]', ev => {
            const name = ev.target.name;
            const val = ev.target.type === 'number' ? Number(ev.target.value || 0) : ev.target.value;
            this.actor.update({ [name]: val });
        });

        html.find('.rollable').click(this._onRoll.bind(this));
        html.find('.weapon-roll').click(this._onWeaponRoll.bind(this));
        html.find('.item-create').click(this._onItemCreate.bind(this));
        html.find('.item-edit').click(ev => {
            const li = $(ev.currentTarget).parents(".item-row");
            const itemId = li.data("item-id");
            const item = this.actor.items.get(itemId);
            if (item) item.sheet.render(true);
        });
        html.find('.item-delete').click(ev => {
            const li = $(ev.currentTarget).parents(".item-row");
            const itemId = li.data("item-id");
            const item = this.actor.items.get(itemId);
            if (item) {
                item.delete();
                li.slideUp(200, () => this.render(false));
            }
        });

        html.find('.item-toggle-usage').click(ev => {
            const li = $(ev.currentTarget).parents(".item-row");
            const itemId = li.data("item-id");
            const item = this.actor.items.get(itemId);
            if (item) {
                item.update({ "system.uso": !item.system.uso });
            }
        });

        html.find('.reset-sheet').click(async (ev) => {
            const confirm = await Dialog.confirm({
                title: "Reiniciar Ficha",
                content: "<p>Tem certeza que deseja recarregar os valores padrão? Isso converterá a ficha para 'Personagem'.</p>",
                yes: () => true, no: () => false, defaultYes: false
            });
            if (confirm) {
                await this.actor.update({ "system": CONFIG.GOT.defaultData });
                ui.notifications.info("Ficha reiniciada!");
            }
        });
        html.find('.roll-initiative').click(this._onInitiativeRoll.bind(this));
        html.find('.relative-remove').click(this._onRemoveRelative.bind(this));
        html.find('.pin-toggle').click(this._onTogglePin.bind(this));
        html.find('.controlled-remove').click(this._onRemoveControlled.bind(this));

        html.find('.unit-rollable').click(this._onUnitRoll.bind(this));
        html.find('.unit-initiative').click(this._onUnitInitiative.bind(this));

        html.find('.sheet-type-select').change(ev => {
            this.actor.update({ "system.tipo_ficha": ev.target.value });
        });

        html.find('.advance-month-btn').click(this._onAdvanceMonth.bind(this));

        html.find('.add-custom-btn').click(this._onAddCustomManeuver.bind(this));
        html.find('.delete-custom-maneuver').click(this._onDeleteCustomManeuver.bind(this));
        html.find('.add-note-btn').click(this._onAddNote.bind(this));
        html.find('.build-structure-btn').click(this._onBuildStructure.bind(this));
        html.find('.upgrade-structure').click(this._onUpgradeStructure.bind(this));
        html.find('.demolish-structure').click(this._onDemolishStructure.bind(this));
        html.find('.add-condition-btn').click(this._onAddCondition.bind(this));
        html.find('.point-adjust').click(this._onPointAdjust.bind(this));
        html.find('.unit-prop-adjust').click(this._onUnitPropAdjust.bind(this));

        html.find('.open-family-tree').on('click', ev => {
            ev.preventDefault();
            ev.stopPropagation();
            if (typeof GOTFamilyTree !== 'undefined') {
                new GOTFamilyTree(this.actor).render(true);
            } else if (window.GOTFamilyTree) {
                new window.GOTFamilyTree(this.actor).render(true);
            } else {
                ui.notifications.error("Aplicação da Árvore Genealógica não encontrada no escopo global.");
            }
        });

        html.find('.btn-toggle-esforco').click(async ev => {
            const current = this.actor.system.combate_intriga.esforco?.value || 0;
            const active = this.actor.system.combate_intriga.esforco_ativo;

            if (!active) {
                if (current <= 0) return ui.notifications.warn("Você não tem Esforço Diário suficiente!");
                await this.actor.update({
                    "system.combate_intriga.esforco.value": current - 1,
                    "system.combate_intriga.esforco_ativo": true
                });
                ui.notifications.info(`${this.actor.name} está se concentrando (Ignorando Lesões).`);
            } else {
                await this.actor.update({ "system.combate_intriga.esforco_ativo": false });
            }
        });

        html.find('.btn-toggle-sacrificio').click(async ev => {
            const active = this.actor.system.combate_intriga.sacrificar_bonus;
            await this.actor.update({ "system.combate_intriga.sacrificar_bonus": !active });
            ui.notifications.info(`${this.actor.name} ${!active ? "ativou" : "desativou"} o modo Ataque Poderoso.`);
        });

        html.find('.btn-gastar-esforco').click(async ev => {
            const current = this.actor.system.combate_intriga.esforco?.value || 0;
            if (current <= 0) return ui.notifications.warn("Você não tem Esforço Diário suficiente!");

            await this.actor.update({ "system.combate_intriga.esforco.value": current - 1 });

            const flavor = `<div class="got-chat-card effort-card">
                <header class="card-header" style="display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #8b0000; padding-bottom: 5px;">
                    <img src="${this.actor.img}" width="32" height="32" style="border: 1px solid #d4af37; border-radius: 3px;"/>
                    <h3 style="margin: 0; font-family: 'Cinzel', serif; color: #8b0000;">Esforço Heróico!</h3>
                </header>
                <div class="card-content" style="padding-top: 5px;">
                    <p style="margin: 5px 0;"><b>${this.actor.name}</b> está se esforçando para uma <b>Ação Adicional!</b></p>
                    <small style="color: #666;">1 ponto de Esforço Diário consumido.</small>
                    <div style="text-align: center; margin-top: 5px;"><i class="fas fa-bolt" style="color: #ffd700; font-size: 1.5em;"></i></div>
                </div>
            </div>`;
            await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                content: flavor
            });
        });
    }

    async _onDropActor(event, data) {
        if (!this.actor.isOwner) return false;
        const actor = await Actor.fromDropData(data);
        if (!actor || actor.id === this.actor.id) return false;

        const dropTarget = event.target.closest('.relative-slot');
        if (dropTarget) {
            const relType = dropTarget.dataset.rel;
            const slotIdx = dropTarget.dataset.index;


            if (this.actor.system.tipo_ficha === "unit") {
                if (relType === "comandante") return this.actor.update({ "system.militar.comandante": actor.id });
                if (relType === "subcomandante") return this.actor.update({ "system.militar.subcomandante": actor.id });
            }

            if (this.actor.system.tipo_ficha === "feud") {
                if (relType === "senhor") return this.actor.update({ "system.dominio.senhor": actor.id });
                if (relType === "castelao") return this.actor.update({ "system.dominio.castelao": actor.id });
                if (relType === "chefe_militar") return this.actor.update({ "system.dominio.chefe_militar": actor.id });
            }

            if (slotIdx !== undefined) {
                const currentRelacoes = foundry.utils.duplicate(this.actor.system.relacoes || { slots: [] });
                currentRelacoes.slots[parseInt(slotIdx)] = { id: actor.id, type: "friend" };
                return this.actor.update({ "system.relacoes": currentRelacoes });
            }
            const currentLinhagem = foundry.utils.duplicate(this.actor.system.linhagem || {});
            if (["pai", "mae", "conjuge"].includes(relType)) {
                currentLinhagem[relType] = actor.id;

                const otherLinhagem = foundry.utils.duplicate(actor.system.linhagem || {});
                if (relType === "pai" || relType === "mae") {
                    if (!otherLinhagem.filhos) otherLinhagem.filhos = [];
                    if (!otherLinhagem.filhos.includes(this.actor.id)) otherLinhagem.filhos.push(this.actor.id);
                } else if (relType === "conjuge") {
                    otherLinhagem.conjuge = this.actor.id;
                }
                await actor.update({ "system.linhagem": otherLinhagem });

            } else {
                if (!currentLinhagem[relType]) currentLinhagem[relType] = [];
                if (!currentLinhagem[relType].includes(actor.id)) {
                    currentLinhagem[relType].push(actor.id);

                    const otherLinhagem = foundry.utils.duplicate(actor.system.linhagem || {});
                    if (relType === "irmaos") {
                        if (!otherLinhagem.irmaos) otherLinhagem.irmaos = [];
                        if (!otherLinhagem.irmaos.includes(this.actor.id)) otherLinhagem.irmaos.push(this.actor.id);
                    } else if (relType === "filhos") {
                        const gender = this.actor.system.info?.genero?.toLowerCase() || "m";
                        const side = (gender === "f" || gender === "feminino") ? "mae" : "pai";
                        otherLinhagem[side] = this.actor.id;
                    }
                    await actor.update({ "system.linhagem": otherLinhagem });
                }
            }
            return this.actor.update({ "system.linhagem": currentLinhagem });
        }

        const currentControles = foundry.utils.duplicate(this.actor.system.controles || []);
        if (!currentControles.includes(actor.id)) {
            currentControles.push(actor.id);
            return this.actor.update({ "system.controles": currentControles });
        }
        return super._onDropActor(event, data);
    }

    async _onRemoveRelative(event) {
        event.preventDefault();
        const target = event.currentTarget;
        const relContainer = target.closest(".relative-item") || target.closest(".relative-slot");
        const type = target.dataset.rel || relContainer?.dataset.rel;

        if (type === "comandante") await this.actor.update({ "system.militar.comandante": "" });
        if (type === "subcomandante") await this.actor.update({ "system.militar.subcomandante": "" });
        if (["senhor", "castelao", "chefe_militar"].includes(type)) {
            await this.actor.update({ [`system.dominio.${type}`]: "" });
        }

        if (!relContainer) return;
        const relType = relContainer.dataset.rel;
        const relId = relContainer.dataset.id;
        const slotIdx = relContainer.dataset.index;

        if (slotIdx !== undefined) {
            const currentRelacoes = foundry.utils.duplicate(this.actor.system.relacoes || { slots: [] });
            currentRelacoes.slots[parseInt(slotIdx)] = { id: "", type: "friend" };
            return this.actor.update({ "system.relacoes": currentRelacoes });
        }

        const currentLinhagem = foundry.utils.duplicate(this.actor.system.linhagem || {});
        const relActor = game.actors.get(relId);

        if (["pai", "mae", "conjuge"].includes(relType)) {
            currentLinhagem[relType] = "";

            if (relActor) {
                const otherLinhagem = foundry.utils.duplicate(relActor.system.linhagem || {});
                if (relType === "pai" || relType === "mae") {
                    otherLinhagem.filhos = (otherLinhagem.filhos || []).filter(id => id !== this.actor.id);
                } else if (relType === "conjuge") {
                    if (otherLinhagem.conjuge === this.actor.id) otherLinhagem.conjuge = "";
                }
                await relActor.update({ "system.linhagem": otherLinhagem });
            }

        } else {
            currentLinhagem[relType] = (currentLinhagem[relType] || []).filter(id => id !== relId);

            if (relActor) {
                const otherLinhagem = foundry.utils.duplicate(relActor.system.linhagem || {});
                if (relType === "irmaos") {
                    otherLinhagem.irmaos = (otherLinhagem.irmaos || []).filter(id => id !== this.actor.id);
                } else if (relType === "filhos") {
                    if (otherLinhagem.pai === this.actor.id) otherLinhagem.pai = "";
                    if (otherLinhagem.mae === this.actor.id) otherLinhagem.mae = "";
                }
                await relActor.update({ "system.linhagem": otherLinhagem });
            }
        }
        return this.actor.update({ "system.linhagem": currentLinhagem });
    }

    async _onRemoveControlled(event) {
        event.preventDefault();
        const id = event.currentTarget.closest('.controlled-item').dataset.id;
        const currentControles = foundry.utils.duplicate(this.actor.system.controles || []).filter(c => c !== id);
        return this.actor.update({ "system.controles": currentControles });
    }

    async _onTogglePin(event) {
        event.preventDefault();
        const slotIdx = event.currentTarget.closest('.relative-slot').dataset.index;
        const currentRelacoes = foundry.utils.duplicate(this.actor.system.relacoes || { slots: [] });

        const order = ["brother", "friend", "acquaintance", "dislike", "enemy", "hated"];
        let currentType = currentRelacoes.slots[slotIdx].type || "friend";

        let nextIdx = (order.indexOf(currentType) + 1) % order.length;
        currentRelacoes.slots[slotIdx].type = order[nextIdx];

        return this.actor.update({ "system.relacoes": currentRelacoes });
    }

    async _onInitiativeRoll(event) {
        event.preventDefault();
        const type = event.currentTarget.dataset.type;
        const isCombate = type === "combat";
        const abilityKey = isCombate ? "agilidade" : "status";
        const abilityValue = this.actor.system.habilidades[abilityKey]?.base || 2;

        const wounds = (Number(this.actor.system.combate_intriga?.lesoes?.value) || 0);
        const injuries = (Number(this.actor.system.combate_intriga?.ferimentos?.value) || 0);
        const frustration = (Number(this.actor.system.combate_intriga?.frustracao?.value) || 0);

        const poolPenalty = isCombate ? wounds : frustration;
        const resultPenalty = isCombate ? injuries : 0;

        let bonusDice = 0;
        if (isCombate) {
            bonusDice = this.actor.system.habilidades?.agilidade?.especialidades?.rapidez || 0;
        }

        const diceCount = Math.max(1, (abilityValue + bonusDice) - poolPenalty);
        const keepCount = Math.max(1, abilityValue - poolPenalty);

        let rollFormula = `${diceCount}d6kh${keepCount}`;
        if (resultPenalty > 0) rollFormula += ` - ${resultPenalty}`;

        const roll = new Roll(rollFormula);
        await roll.evaluate();

        let penaltyLabel = "";
        if (bonusDice > 0) penaltyLabel += `<br><span style="color:blue">Bônus de Rapidez: +${bonusDice}B</span>`;
        if (poolPenalty > 0) penaltyLabel += `<br><span style="color:red">Penalidade de Dados: -${poolPenalty}D</span>`;
        if (resultPenalty > 0) penaltyLabel += `<br><span style="color:red">Penalidade Result.: -${resultPenalty}</span>`;

        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: `<b>Iniciativa de ${isCombate ? "Combate" : "Intriga"}</b><br>Usando ${isCombate ? "Agilidade" : "Status"}: ${abilityValue}${penaltyLabel}`
        });
        if (game.combat) {
            const combatant = game.combat.combatants.find(c => c.actorId === this.actor.id);
            if (combatant) await combatant.update({ initiative: roll.total });
        }
    }

    async _onItemCreate(event) {
        event.preventDefault();
        const type = event.currentTarget.dataset.type;
        const img = type === "montaria" ? "icons/creatures/mammals/horse-gaits-heavy-gray.webp" : "icons/svg/item-bag.svg";
        const itemData = { name: `Novo(a) ${type}`, type: "item", img: img, system: { type: type } };
        return await this.actor.createEmbeddedDocuments("Item", [itemData]);
    }

    async _onWeaponRoll(event) {
        event.preventDefault();
        const li = $(event.currentTarget).parents(".item-row");
        const itemId = li.data("item-id");
        if (!itemId) return console.error("GOT | Item ID not found on parent .item-row");
        return this.rollWeapon(itemId);
    }

    async rollWeapon(itemId) {
        const item = this.actor.items.get(itemId);
        if (!item) return;

        const system = item.system;
        const name = (item.name || "").toLowerCase();
        const esp = (system.especialidade || "").toLowerCase();

        let abilityKey = system.habilidade_ataque;
        if (!abilityKey) {
            if (system.type_pontaria || esp.includes("arcos") || name.includes("arco") || esp.includes("bestas") || name.includes("besta") || esp.includes("arremesso")) {
                abilityKey = "pontaria";
            } else {
                abilityKey = "luta";
            }
        }
        const ability = this.actor.system.habilidades[abilityKey]?.base || 2;

        const specialtyName = (system.especialidade || "").trim();
        let specBonus = 0;
        if (specialtyName) {
            const normSpec = specialtyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ");
            const specs = this.actor.system.habilidades?.[abilityKey]?.especialidades || {};

            for (let [key, val] of Object.entries(specs)) {
                const normKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ");
                if (normKey === normSpec) {
                    specBonus = val;
                    break;
                }
            }
        }

        let sacrificedDice = 0;
        let powerAttackMsg = "";
        let powerAttackDmgBonus = 0;
        if (this.actor.system.combate_intriga?.sacrificar_bonus) {
            sacrificedDice = specBonus;
            specBonus = 0;
            if (sacrificedDice > 0) {
                powerAttackDmgBonus = this.actor.system.habilidades?.atletismo?.base || 0;
                powerAttackMsg = `<br><b>Dados Sacrificados:</b> ${sacrificedDice} (Ataque Poderoso) <br><b>Dano Extra:</b> +${powerAttackDmgBonus}`;
            }
        }

        let attrKey = system.atributo_dano;
        if (!attrKey) {
            if (esp.includes("curtas") || name.includes("adaga") || name.includes("faca") || name.includes("punhal") || name.includes("espada curta")) {
                attrKey = "agilidade";
            } else if (esp.includes("bestas") || name.includes("besta")) {
                attrKey = "agilidade";
            } else if (esp.includes("arcos") || name.includes("arco")) {
                attrKey = "agilidade";
            } else {
                attrKey = "atletismo";
            }
        }

        let ammoMsg = "";
        const ammoType = system.tipo_municao;

        if (ammoType) {
            const ammoItem = this.actor.items.find(i => i.system.type === "equipamento" && i.system.is_ammo === true && (i.system.tipo_municao || "").trim().toLowerCase() === ammoType.trim().toLowerCase());

            if (ammoItem) {
                const qtd = Number(ammoItem.system.quantidade || 0);
                if (qtd > 0) {
                    await ammoItem.update({ "system.quantidade": qtd - 1 });
                    ammoMsg = `<br>Munição: ${ammoItem.name} (${qtd - 1} restantes)`;
                } else {
                    return ui.notifications.warn(`Sem munição (${ammoType}) para disparar!`);
                }
            } else {
                return ui.notifications.warn(`Nenhuma munição do tipo "${ammoType}" encontrada!`);
            }
        }

        const attrVal = attrKey === "nenhum" ? 0 : (this.actor.system.habilidades[attrKey]?.base || 0);

        // Mounted & Charge Logic
        const mount = this.actor.items?.find(i => i.system?.type === "montaria" && i.system?.uso === true);
        const isMounted = !!mount;
        const propsText = (system.propriedades || "").toLowerCase() + " " + (system.description || "").toLowerCase();
        const isMountedWeapon = propsText.includes("montada") || propsText.includes("mounted");
        
        let mountPoolPenalty = 0;
        let mountBonusDice = 0;
        let mountDmgBonus = 0;
        let mountFlavorMsg = "";

        if (isMountedWeapon && !isMounted) {
            mountPoolPenalty = 2;
            mountFlavorMsg += `<br><span style="color:red">Penalidade (Arma Montada a pé): -2D</span>`;
        }

        if (isMounted && abilityKey === "luta") {
            mountBonusDice = 1;
            mountFlavorMsg += `<br><span style="color:blue">Vantagem de Altura: +1B</span>`;
        }

        const isCharging = this.actor.getFlag("got-character-sheet", "charging");
        if (isCharging) {
            mountDmgBonus = 2;
            mountFlavorMsg += `<br><b>Bônus de Carga:</b> +2 Dano`;
            await this.actor.setFlag("got-character-sheet", "charging", false);
        }

        const damage = (system.dano || 0) + attrVal + powerAttackDmgBonus + mountDmgBonus;

        let totalAP = 0;
        this.actor.items.forEach(i => {
            if (i.system.type === 'armadura' && i.system.uso) {
                totalAP += Number(i.system.ap || 0);
            }
        });

        const woundsRaw = (Number(this.actor.system.combate_intriga?.lesoes?.value) || 0);
        const injuries = (Number(this.actor.system.combate_intriga?.ferimentos?.value) || 0);

        let effectiveWounds = woundsRaw;
        if (this.actor.system.combate_intriga?.esforco_ativo === true && effectiveWounds > 0) {
            effectiveWounds -= 1;
        }

        const totalBonusDice = (system.bonus_dice || 0) + specBonus + mountBonusDice;
        const totalPoolCount = Math.max(1, ability + totalBonusDice - effectiveWounds - mountPoolPenalty);
        let rollFormula = `${totalPoolCount}d6kh${ability - mountPoolPenalty}`;
        if (injuries > 0) rollFormula += ` - ${injuries}`;
        if (attrKey === "agilidade" && totalAP !== 0) {
            rollFormula += ` ${totalAP > 0 ? '+' : ''}${totalAP}`;
        }

        const roll = new Roll(rollFormula);
        await roll.evaluate();

        const diceResults = roll.dice.flatMap(d => d.results.map(r => r.result));
        const count6s = diceResults.filter(r => r === 6).length;
        const count1s = diceResults.filter(r => r === 1).length;

        const critTable = {
            1: { label: "Acerto Sólido", effect: "Dano +2", desc: "Você acerta um golpe firme. Aumente o dano básico da arma em +2 para este ataque.", dmgBonus: 2 },
            2: { label: "Acerto Poderoso", effect: "Dano +4", desc: "Seu ataque deixa o oponente abalado. Aumente o dano básico da arma em +4 para este ataque.", dmgBonus: 4 },
            3: { label: "Ferida Sangrenta", effect: "+1 Ferimento", desc: "Seu ataque causa sangramento. Além do dano causado, seu alvo recebe 1 ferimento. Caso o oponente não possa aceitar mais um ferimento, sofre uma lesão. Caso não possa aceitar uma lesão, morre." },
            4: { label: "Ferimento Incapacitante", effect: "+1 Lesão", desc: "Você deixa seu oponente incapacitado com um ferimento horrível. Além do dano causado, seu alvo recebe 1 lesão (não reduz dano). Caso o oponente não possa aceitar mais uma lesão, morre." },
            5: { label: "Golpe Matador", effect: "Morte Instantânea", desc: "Seu ataque mata o oponente instantaneamente." },
            6: { label: "Golpe Terrível", effect: "Morte + Área", desc: "Além de matar seu inimigo instantaneamente, você causa seu dano básico (sem graus) a todos oponentes adjacentes à vítima." },
            7: { label: "Morte Impressionante", effect: "Morte + Buff Aliado", desc: "Seu ataque mata o oponente. Além disso, é tão impressionante que todos os seus aliados recebem +1B em todos os testes até o fim do combate." },
            8: { label: "Morte Horrenda", effect: "Morte + Choque de Vontade", desc: "Você mata seu oponente com tamanha força que abala as testemunhas. Inimigos devem passar em Vontade (9) ou sofrer -1D por uma rodada. Você recebe +1B até o fim do combate." }
        };

        const fumbleTable = {
            1: { label: "Ferimento Autoinfligido", desc: "Manuseando sua arma de maneira errada, você fere a si mesmo. Sofra o dano da arma." },
            2: { label: "Atacar Aliado", desc: "Você atinge um aliado em vez do alvo. Rolle um novo ataque contra um aliado adjacente ou no alcance." },
            3: { label: "Largar Arma", desc: "A arma escapa de sua mão, caindo a 1d6 metros de distância em uma direção aleatória." },
            4: { label: "Dano Menor", desc: "A arma danifica-se por uso excessivo. Reduza o dano em -1 permanentemente (Trate como '3' se for castelo ou melhor)." },
            5: { label: "Quebra", desc: "A arma se parte. Ela agora é inútil e não pode ser consertada (Trate como '4' se for castelo, '3' se for Aço Valiriano)." },
            6: { label: "Cabo Escorregadio", desc: "Sangue ou suor torna o cabo escorregadio. Sofra -1D em todos os ataques até o fim do seu próximo turno." },
            7: { label: "Sangue nos Olhos", desc: "Sangue ou suor cai em seus olhos, afetando sua visão. Sofra -1D em todos os testes até o fim do seu próximo turno." },
            8: { label: "Ataque Exagerado", desc: "Você perde o equilíbrio e oferece uma abertura. Sofra -5 em Defesa em Combate até o início do seu próximo turno." }
        };

        const props = (system.propriedades || "").toLowerCase();
        const desc = (system.description || "").toLowerCase();
        const fullText = `${name} ${props} ${desc}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        const isCruel = fullText.includes("cruel");
        const isPowerful = fullText.includes("poderosa") || fullText.includes("powerful");

        let propList = [];
        if (isCruel) propList.push("Cruel");
        if (isPowerful) propList.push("Poderosa");

        const pMatch = fullText.match(/(?:perfurante|piercing)\s*[+]?(\d+)/);
        const ignoredAR = pMatch ? Number(pMatch[1]) : (fullText.includes("perfurante") || fullText.includes("piercing") ? 1 : 0);
        if (ignoredAR > 0) propList.push(`Perfurante ${ignoredAR}`);

        if (fullText.includes("lenta") || fullText.includes("slow")) propList.push("Lenta");

        const reminders = [];
        if (fullText.includes("alcance") || fullText.includes("reach")) reminders.push("Alcance");
        if (fullText.includes("recarga") || fullText.includes("reload")) reminders.push("Recarga");
        if (fullText.includes("arremesso") || fullText.includes("thrown")) reminders.push("Arremesso");
        if (fullText.includes("desarmar") || fullText.includes("disarming")) reminders.push("Desarmar");
        if (fullText.includes("estilhacar") || fullText.includes("shattering")) reminders.push("Estilhaçar");
        if (fullText.includes("fragil") || fullText.includes("fragile")) reminders.push("Frágil");
        if (fullText.includes("montada") || fullText.includes("mounted")) reminders.push("Montada");
        if (fullText.includes("longa") || fullText.includes("long")) reminders.push("Longa");

        let flavor = `<b>Ataque com ${item.name}</b><br>
                    Atributo de Dano: <i>${attrKey.toUpperCase()}</i><br>
                    Dano Base: <b>${damage}</b> (${system.dano} + ${attrVal})${powerAttackMsg}${ammoMsg}`;

        if (propList.length > 0) {
            flavor += `<br>Propriedades: <i>${propList.join(", ")}</i>`;
        }
        if (reminders.length > 0) {
            flavor += `<br><small style="color:#666;">(Lembrete: ${reminders.join(", ")})</small>`;
        }
        if (mountFlavorMsg) {
            flavor += mountFlavorMsg;
        }

        const combat = this._calculateCombatResult(roll.total, "combat");
        if (combat) {
            const isHit = combat.margin >= 0;
            let critMsg = "";
            let fumbleMsg = "";
            let extraCritDmg = 0;

            if (isHit && count6s > 0) {
                const tableEntry = critTable[Math.min(8, count6s)];
                critMsg = `
                <details class="crit-event" style="color:#006400; border:1px solid #006400; padding:5px; margin-top:5px; background: rgba(0,100,0,0.05);">
                    <summary style="cursor:pointer;"><b>CRÍTICO: ${tableEntry.label} (+${count6s})</b><br><small>${tableEntry.effect}</small></summary>
                    <p style="font-size: 0.9em; margin-top: 5px; color: #333;">${tableEntry.desc}</p>
                </details>`;
                extraCritDmg = tableEntry.dmgBonus || 0;
            } else if (!isHit && count1s > 0) {
                const tableEntry = fumbleTable[Math.min(8, count1s)];
                fumbleMsg = `
                <details class="fumble-event" style="color:#8b0000; border:1px solid #8b0000; padding:5px; margin-top:5px; background: rgba(139,0,0,0.05);">
                    <summary style="cursor:pointer;"><b>FALHA: ${tableEntry.label} (+${count1s})</b><br><small>Clique para detalhes</small></summary>
                    <p style="font-size: 0.9em; margin-top: 5px; color: #333;">${tableEntry.desc}</p>
                </details>`;
            }

            if (critMsg) flavor += critMsg;
            if (fumbleMsg) flavor += fumbleMsg;

            if (effectiveWounds > 0) flavor += `<br><span style="color:red">Penalidade (Lesão): -${effectiveWounds}D</span>`;
            if (injuries > 0) flavor += `<br><span style="color:red">Penalidade (Ferimento): -${injuries}</span>`;
            if (totalAP !== 0 && attrKey === "agilidade") flavor += `<br>Penalidade de Armadura: ${totalAP}`;

            const degrees = Math.max(1, combat.degrees);

            const multiplier = attrVal + (isCruel ? 2 : 0);
            const extraDmg = multiplier * (degrees - 1);

            let finalDmg = damage + extraDmg + extraCritDmg;

            let powerfulBonus = 0;
            if (isPowerful) {
                powerfulBonus = this.actor.system.habilidades?.atletismo?.base || 2;
                finalDmg += powerfulBonus;
                flavor += `<br><small>(Poderosa: +${powerfulBonus} Dano)</small>`;
            }

            if (fullText.includes("dano +")) {
                const dMatch = fullText.match(/dano\s*[+]?(\d+)/);
                if (dMatch) {
                    const dBonus = Number(dMatch[1]);
                    finalDmg += dBonus;
                    flavor += `<br><small>(Bônus: +${dBonus} Dano)</small>`;
                }
            }

            if (fullText.includes("lenta") || fullText.includes("slow")) {
                flavor += `<br><small style="color:#d32f2f;">(Lenta: Exige Ação Maior)</small>`;
            }

            let arMsg = "";
            let effectiveAR = Math.max(0, combat.ar - ignoredAR);
            if (effectiveAR > 0) {
                finalDmg = Math.max(0, finalDmg - effectiveAR);
                arMsg = ` (-${effectiveAR} AR)`;
            }

            flavor += `<hr><b>Alvo:</b> ${combat.targetName}`;
            flavor += `<br>Defesa: ${combat.defense} | Margem: ${combat.margin >= 0 ? "+" : ""}${combat.margin}`;

            if (isHit) {
                flavor += `<br>Graus de Sucesso: <b>${degrees}</b>${isCruel ? ' <span style="color:red">(Cruel!)</span>' : ''}`;
                const critCalcMsg = extraCritDmg > 0 ? ` + ${extraCritDmg} Crit` : "";
                const powS = powerfulBonus > 0 ? ` + ${powerfulBonus} Poderosa` : "";
                flavor += `<br>Dano Final: <b>${finalDmg}</b> (${damage} + ${extraDmg}${powS}${critCalcMsg}${arMsg})`;
                
                // Context-Aware Damage Buttons
                if (combat.targetType === "unit") {
                    flavor += `<div class="combat-damage-buttons" style="margin-top: 10px;">
                        <button class="apply-unit-damage-btn" data-target-id="${combat.targetId}" data-damage="${finalDmg}" style="background: rgba(139, 0, 0, 0.8); color: white; border: 1px solid gold; border-radius: 4px; cursor: pointer; padding: 6px; width: 100%;">
                            <i class="fas fa-fist-raised"></i> Aplicar Dano à Tropa (${finalDmg})
                        </button>
                    </div>`;
                } else {
                    flavor += `<div class="combat-damage-buttons" style="margin-top: 10px; display: flex; flex-direction: column; gap: 5px;">
                        <button class="apply-damage-btn" data-target-id="${combat.targetId}" data-damage="${finalDmg}" style="background: rgba(139, 0, 0, 0.8); color: white; border: 1px solid gold; border-radius: 4px; cursor: pointer; padding: 4px;">
                            <i class="fas fa-heart-broken"></i> Aplicar Dano (${finalDmg})
                        </button>
                        <button class="apply-injury-btn" data-target-id="${combat.targetId}" data-damage="${finalDmg}" style="background: rgba(184, 134, 11, 0.8); color: white; border: 1px solid gold; border-radius: 4px; cursor: pointer; padding: 4px;">
                            <i class="fas fa-hand-holding-medical"></i> Receber Ferimento (-Resistência)
                        </button>
                        <button class="apply-wound-btn" data-target-id="${combat.targetId}" data-damage="${finalDmg}" style="background: rgba(47, 79, 79, 0.8); color: white; border: 1px solid gold; border-radius: 4px; cursor: pointer; padding: 4px;">
                            <i class="fas fa-skull"></i> Receber Lesão (0 Dano)
                        </button>
                        <button class="apply-mount-damage-btn" data-target-id="${combat.targetId}" data-damage="${finalDmg}" style="background: rgba(139, 69, 19, 0.8); color: white; border: 1px solid #d2691e; border-radius: 4px; cursor: pointer; padding: 4px;">
                            <i class="fas fa-horse"></i> Aplicar Dano à Montaria (${finalDmg})
                        </button>
                    </div>`;
                }
            } else {
                flavor += `<br><span style="color:red">Errou o ataque!</span>`;
            }
        } else {
            if (wounds > 0) flavor += `<br><span style="color:red">Penalidade (Lesão): -${wounds}D</span>`;
            if (injuries > 0) flavor += `<br><span style="color:red">Penalidade (Ferimento): -${injuries}</span>`;
        }

        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: flavor
        });
    }

    async _onUnitRoll(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const statKey = element.dataset.stat;
        const statLabel = element.dataset.label;
        const system = this.actor.system.militar;

        const typeKey = system.tipo || "Infantaria";
        const baseStats = CONFIG.GOT.unitBaseStats?.[typeKey] || CONFIG.GOT.unitBaseStats?.["Infantaria"] || {};

        let ability = (Number(baseStats[statKey]) || 0) +
            (Number(system[statKey]) || 0) +
            (Number(system.pontos?.[statKey]) || 0);

        if (ability <= 0) ability = 1;

        const trainingLevels = { "Recruta": 0, "Treinado": 1, "Veterano": 2, "Elite": 3 };
        const training = system.treinamento || "Recruta";
        let bonusDice = trainingLevels[training] || 0;

        if (statKey === "luta") {
            const tactPoints = Number(system.pontos?.luta_tac || 0);
            bonusDice += (tactPoints * 2);
        }

        const totalDice = ability + bonusDice;

        const rawSize = system.tamanho || "";
        const normSize = rawSize.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        let sizeMult = 1;
        let requiredWarfare = 1;

        if (normSize.includes("unidade")) { sizeMult = 2; requiredWarfare = 2; }
        else if (normSize.includes("batalhao")) { sizeMult = 3; requiredWarfare = 3; }
        else if (normSize.includes("legiao")) { sizeMult = 4; requiredWarfare = 4; }
        let warfare = 2;
        if (system.comandante) {
            const cmd = game.actors.get(system.comandante);
            if (cmd) warfare = cmd.system.habilidades?.guerra?.base || 2;
        }

        let penaltyMsg = "";
        if (warfare < requiredWarfare) {
            sizeMult = 1;
            penaltyMsg = `<br><span style="color:red; font-weight:bold;">⚠️ Penalidade de Comando!</span><br>Guerra insuficiente (${warfare} vs ${requiredWarfare}). Dano não multiplicado.`;
        }

        const basePower = (Number(baseStats.poder) || 0);
        const manualPower = (Number(system.poder) || 0);
        const pointsPower = (Number(system.pontos?.poder) || 0);
        const totalPower = basePower + manualPower + pointsPower;
        const damage = totalPower * sizeMult;

        const roll = new Roll(`${totalDice}d6kh${ability}`);
        await roll.evaluate();

        let flavor = `<b>Teste de ${statLabel} (Tropa)</b><br>`;
        flavor += `Treinamento: ${training} (+${bonusDice}D)<br>`;

        if (statKey === "poder") {
            flavor = `<b>Rolagem de Dano (Tropa)</b><br>`;
            flavor += `Dano Total: <b>${damage}</b> (Poder ${totalPower} x${sizeMult} Tamanho)${penaltyMsg}`;
            return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: flavor });
        }

        if (["luta", "pontaria"].includes(statKey)) {
            flavor += `Dano Base: <b>${damage}</b> (Poder ${totalPower} x${sizeMult} Tamanho)${penaltyMsg}`;
            const combat = this._calculateCombatResult(roll.total, "combat");
            if (combat) {
                const degrees = Math.max(1, combat.degrees);
                let finalDmg = damage + (degrees - 1);
                let arMsg = "";
                if (combat.ar > 0) {
                    finalDmg = Math.max(0, finalDmg - combat.ar);
                    arMsg = ` (-${combat.ar} AR)`;
                }
                flavor += `<hr><b>Alvo:</b> ${combat.targetName}<br>Defesa: ${combat.defense} | Margem: ${combat.margin >= 0 ? "+" : ""}${combat.margin}`;
                if (combat.margin >= 0) {
                    flavor += `<br>Graus: <b>${degrees}</b><br>Dano Final: <b>${finalDmg}</b> (${damage} + ${degrees - 1} Graus${arMsg})`;
                    
                    // Context-Aware Damage Buttons
                    if (combat.targetType === "unit") {
                        flavor += `<button class="apply-unit-damage-btn" data-target-id="${combat.targetId}" data-damage="${finalDmg}" style="margin-top: 10px; cursor: pointer; background: rgba(139, 0, 0, 0.8); color: white; border: 1px solid gold; border-radius: 4px; padding: 6px; width: 100%;">
                            <i class="fas fa-fist-raised"></i> Aplicar Dano à Tropa (${finalDmg})
                        </button>`;
                    } else {
                        flavor += `<div class="combat-damage-buttons" style="margin-top: 10px; display: flex; flex-direction: column; gap: 5px;">
                            <button class="apply-damage-btn" data-target-id="${combat.targetId}" data-damage="${finalDmg}" style="background: rgba(139, 0, 0, 0.8); color: white; border: 1px solid gold; border-radius: 4px; cursor: pointer; padding: 4px;">
                                <i class="fas fa-heart-broken"></i> Aplicar Dano (${finalDmg})
                            </button>
                            <button class="apply-injury-btn" data-target-id="${combat.targetId}" data-damage="${finalDmg}" style="background: rgba(184, 134, 11, 0.8); color: white; border: 1px solid gold; border-radius: 4px; cursor: pointer; padding: 4px;">
                                <i class="fas fa-hand-holding-medical"></i> Receber Ferimento (-Resistência)
                            </button>
                            <button class="apply-wound-btn" data-target-id="${combat.targetId}" data-damage="${finalDmg}" style="background: rgba(47, 79, 79, 0.8); color: white; border: 1px solid gold; border-radius: 4px; cursor: pointer; padding: 4px;">
                                <i class="fas fa-skull"></i> Receber Lesão (0 Dano)
                            </button>
                        </div>`;
                    }
                } else {
                    flavor += `<br><span style="color:red">Errou o ataque!</span>`;
                }
            }
        }

        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: flavor
        });
    }

    async _onUnitInitiative(event) {
        event.preventDefault();
        const system = this.actor.system.militar;
        let warfare = 2; // Default
        let label = "Iniciativa de Massa (Tropa)";

        if (system.comandante) {
            const cmd = game.actors.get(system.comandante);
            if (cmd) {
                warfare = cmd.system.habilidades?.guerra?.base || 2;
                label = `Iniciativa de Massa (Comandante: ${cmd.name})`;
            }
        }

        const roll = new Roll(`${warfare}d6`);
        await roll.evaluate(); // V12 asynchronous evaluation

        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: `<b>${label}</b><br>Usando Guerra: ${warfare}`
        });

        if (game.combat) {
            const combatant = game.combat.combatants.find(c => c.actorId === this.actor.id);
            if (combatant) await combatant.update({ initiative: roll.total });
        }
    }

    async _onAddCustomManeuver(event) {
        event.preventDefault();
        const m = this.actor.system.militar;
        const currentManeuvers = foundry.utils.duplicate(m.manobras_custom || []);

        const content = `
      <form>
        <div class="form-group"><label>Nome</label><input type="text" id="man-name" placeholder="Nome da Manobra"></div>
        <div class="form-group">
          <label>Especialidade</label>
          <select id="man-spec">
            <option value="TÃ¡tica">TÃ¡tica</option>
            <option value="Comando">Comando</option>
            <option value="EstratÃ©gia">EstratÃ©gia</option>
          </select>
        </div>
        <div class="form-group"><label>NÃ­vel NecessÃ¡rio</label><input type="number" id="man-req" value="1"></div>
        <div class="form-group"><label>BÃ´nus</label><input type="text" id="man-bonus" placeholder="+1D Luta"></div>
        <div class="form-group"><label>DescriÃ§Ã£o</label><textarea id="man-desc" placeholder="Efeito da manobra..."></textarea></div>
      </form>
    `;

        new Dialog({
            title: "Adicionar Manobra Personalizada",
            content: content,
            buttons: {
                add: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Adicionar",
                    callback: async (html) => {
                        const name = html.find('#man-name').val();
                        const specialty = html.find('#man-spec').val();
                        const req = parseInt(html.find('#man-req').val()) || 1;
                        const bonus = html.find('#man-bonus').val();
                        const desc = html.find('#man-desc').val();

                        if (name) {
                            currentManeuvers.push({ name, specialty, req, bonus, desc });
                            await this.actor.update({ "system.militar.manobras_custom": currentManeuvers });
                        }
                    }
                },
                cancel: { label: "Cancelar" }
            },
            default: "add"
        }).render(true);
    }

    async _onDeleteCustomManeuver(event) {
        event.preventDefault();
        const index = event.currentTarget.closest('.custom-maneuver-item').dataset.index;
        const currentManeuvers = foundry.utils.duplicate(this.actor.system.militar.manobras_custom || []);
        currentManeuvers.splice(index, 1);
        await this.actor.update({ "system.militar.manobras_custom": currentManeuvers });
    }

    async _onAddCondition(event) {
        event.preventDefault();
        const condition = event.currentTarget.dataset.condition;
        const currentNotes = this.actor.system.dominio.notas || "";

        // Toggle logic: If condition is in notes, remove it. Else, add it.
        const regex = new RegExp(`(<br\\s*\\/?>)?\\s*<strong>${condition}<\\/strong>`, "i");
        let newNotes;

        if (regex.test(currentNotes)) {
            newNotes = currentNotes.replace(regex, "");
        } else {
            newNotes = currentNotes + (currentNotes ? "<br/>" : "") + `<strong>${condition}</strong>`;
        }

        await this.actor.update({ "system.dominio.notas": newNotes });
    }

    async _onAddNote(event) {
        event.preventDefault();
        const layout = this.actor.system.tipo_ficha || "character";
        const notePath = layout === "unit" ? "system.militar.notas" : "system.dominio.notas";
        const currentNotes = layout === "unit" ? (this.actor.system.militar?.notas || "") : (this.actor.system.dominio?.notas || "");

        const content = `<form>
            <div class="form-group">
                <label>Nova Entrada de HistÃ³rico</label>
                <textarea id="note-text" style="width: 100%; height: 100px;" placeholder="Descreva o evento..."></textarea>
            </div>
        </form>`;

        new Dialog({
            title: "Adicionar Nota de HistÃ³rico",
            content: content,
            buttons: {
                add: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Adicionar",
                    callback: async (html) => {
                        const newText = html.find("#note-text").val();
                        if (!newText) return;
                        const timestamp = new Date().toLocaleDateString("pt-BR");
                        const entry = `<p><strong>[${timestamp}]</strong>: ${newText}</p>`;
                        const updatedNotes = currentNotes + entry;
                        await this.actor.update({ [notePath]: updatedNotes });
                        ui.notifications.info("Nota adicionada ao histÃ³rico!");
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancelar"
                }
            },
            default: "add"
        }).render(true);
    }

    async _onPointAdjust(event) {
        event.preventDefault();
        const btn = $(event.currentTarget);
        const action = btn.data("action"); // "add" or "sub"
        const key = btn.data("key");
        const category = btn.data("category");

        // We need recalculate budgets here to verify limits, or rely on context?
        // Relying on data from _prepareUnitData isn't safe for async updates. Recalc briefly.

        // Resolve leader briefly
        const resolveSpec = (id, spec) => {
            if (!id) return 0;
            const a = game.actors.get(id);
            if (!a) return 0;
            const s = a.system.habilidades?.guerra?.especialidades || {};
            // Normalization
            const norm = spec.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            for (let [k, v] of Object.entries(s)) {
                if (k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === norm) return v;
            }
            return 0;
        };

        const m = this.actor.system.militar;
        const cmdId = m.comandante;
        const subId = m.subcomandante;

        // Helper to get total specialty from both leaders
        const getCombinedSpec = (specName) => {
            let total = 0;
            total += resolveSpec(cmdId, specName);
            total += resolveSpec(subId, specName);
            return total;
        };

        // Budget Calc
        let budget = 0;
        if (category === "comando") budget = getCombinedSpec("comando") * 2;
        else if (category === "estrategia") budget = getCombinedSpec("estrategia") * 2;
        else if (category === "tatica") budget = getCombinedSpec("tatica") * 2;

        // Current usage
        const currentPoints = m.pontos || {};
        const currentVal = currentPoints[key] || 0;

        // Calculate total used in this category
        // We know the keys for each category from our logic in prepareUnitData
        const keysMap = {
            comando: ["luta", "disciplina", "atletismo"],
            estrategia: ["movimento", "pontaria", "percepcao"],
            tatica: ["agilidade", "poder", "luta_tac"]
        };
        const catKeys = keysMap[category] || [];
        const totalUsed = catKeys.reduce((acc, k) => acc + (currentPoints[k] || 0), 0);
        const available = budget - totalUsed;

        if (action === "add") {
            if (available > 0) {
                await this.actor.update({ [`system.militar.pontos.${key}`]: currentVal + 1 });
            } else {
                ui.notifications.warn("Sem pontos disponiveis nesta categoria de comando!");
            }
        } else if (action === "sub") {
            // Allow negative points only for Disciplina to reorganize troop (reclaiming base points)
            if (currentVal > 0 || key === "disciplina") {
                await this.actor.update({ [`system.militar.pontos.${key}`]: currentVal - 1 });
            }
        }
    }


    async _onUnitPropAdjust(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const key = element.dataset.key; // e.g., 'bonus_armadura'
        const delta = parseInt(element.dataset.delta);
        const current = this.actor.system.militar[key] || 0;

        await this.actor.update({ [`system.militar.${key}`]: current + delta });
    }

    async _onBuildStructure(event) {
        event.preventDefault();
        const d = this.actor.system.dominio;
        const structures = CONFIG.GOT.structures;

        // Resolve Castelao and multipliers again for the dialog logic
        const hSenhor = game.actors.get(d.senhor)?.system.habilidades?.status || { especialidades: {} };
        const hAdmin = game.actors.get(d.castelao)?.system.habilidades?.status || { especialidades: {} };
        const gestao = (hAdmin.especialidades?.["gestao"] || hAdmin.especialidades?.gestao || 0) + (hSenhor.especialidades?.["gestao"] || hSenhor.especialidades?.gestao || 0);
        const torneios = (hAdmin.especialidades?.torneios || 0) + (hSenhor.especialidades?.torneios || 0);
        const costMod = 1 - (gestao * 0.05);

        const current = foundry.utils.duplicate(d.estruturas || []);
        let infraBonus = { max_estruturas: 0 };
        current.forEach(s => {
            const config = structures[s.id];
            if (config?.bonus?.max_estruturas) infraBonus.max_estruturas += config.bonus.max_estruturas * (s.level || 1);
        });
        const limit = (d.max_estruturas_base || 5) + infraBonus.max_estruturas;

        if (current.length >= limit) {
            return ui.notifications.warn(`Limite de construcoes atingido (${limit})!`);
        }

        let content = `<form>
      <div class="form-group">
        <label>Escolha a Estrutura</label>
        <select id="structure-choice" style="width: 100%;">`;

        const checkCost = (costObj, mod) => {
            const affordable = {};
            for (let [res, amt] of Object.entries(costObj)) {
                const totalCost = Math.ceil(amt * mod);
                affordable[res] = {
                    amt: totalCost,
                    canPay: (d[res] || 0) >= totalCost
                };
            }
            return affordable;
        };

        const serializeCost = (costs) => {
            return Object.entries(costs).map(([res, info]) => {
                const color = info.canPay ? "#2e7d32" : "#c62828";
                return `<span style="color: ${color}; font-weight: bold;">${info.amt} ${res.charAt(0).toUpperCase() + res.slice(1)}</span>`;
            }).join(", ");
        };

        const serializeBonus = (bonus) => {
            if (!bonus) return "Nenhum";
            return Object.entries(bonus).map(([k, v]) => {
                const icons = { comida: "🌾", fortuna: "💰", ordem: "😊", defesa: "🛡️", populacao: "👥", soldados: "⚔️", max_estruturas: "🔨", influencia: "👑", poder: "👊", vida_muralha: "🧱" };
                return `${icons[k] || ""} +${v} ${k.charAt(0).toUpperCase() + k.slice(1)}`;
            }).join(", ");
        };

        for (let [id, config] of Object.entries(structures)) {
            if (id === "centro_urbano" && current.some(s => s.id === "centro_urbano")) continue;

            // Requirements
            if (config.req) {
                if (config.req.torneios && torneios < config.req.torneios) continue;
                if (config.req.gestao && gestao < config.req.gestao) continue;
            }

            const costs = checkCost(config.cost, costMod);
            content += `<option value="${id}" data-desc="${config.desc}" data-gain="${serializeBonus(config.bonus)}" data-costs='${JSON.stringify(costs)}'>${config.name}</option>`;
        }
        content += `</select></div>
      <div id="build-preview" style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 5px;">
        <p id="preview-cost"></p>
        <p id="preview-desc" style="font-size: 0.9em; border-top: 1px solid #ccc; padding-top: 5px;"></p>
        <p id="preview-gain" style="font-size: 0.9em;"></p>
      </div>
    </form>`;

        new Dialog({
            title: "Construir Nova Estrutura",
            content: content,
            render: (html) => {
                const updatePreview = () => {
                    const selected = html.find('#structure-choice option:selected');
                    const costs = selected.data('costs');

                    let costHtml = "<strong>Custos:</strong> ";
                    costHtml += Object.entries(costs).map(([res, info]) => {
                        const currentVal = Number(d[res] || 0);
                        const requiredAmt = Number(info.amt);
                        const color = currentVal >= requiredAmt ? "#2e7d32" : "#d32f2f";
                        return `<span style="color: ${color}; font-weight: bold;">${info.amt} ${res.charAt(0).toUpperCase() + res.slice(1)}</span>`;
                    }).join(", ");

                    html.find('#preview-cost').html(costHtml);
                    html.find('#preview-desc').html(`<strong>Descricao:</strong> ${selected.data('desc')}`);
                    html.find('#preview-gain').html(`<strong>Ganhos Base (Nvl 1):</strong> ${selected.data('gain')}`);
                };
                html.find('#structure-choice').change(updatePreview);
                updatePreview();
            },
            buttons: {
                build: {
                    icon: '<i class="fas fa-hammer"></i>',
                    label: "Construir",
                    callback: async (html) => {
                        const choice = html.find('#structure-choice').val();
                        const config = structures[choice];
                        const updates = { "system.dominio.estruturas": [...current, { id: choice, level: 1 }] };

                        for (let [res, amt] of Object.entries(config.cost)) {
                            if (d[res] !== undefined) updates[`system.dominio.${res}`] = Math.max(0, d[res] - Math.ceil(amt * costMod));
                        }

                        await this.actor.update(updates);
                        ui.notifications.info(`"${config.name}" construido(a)!`);
                    }
                },
                cancel: { label: "Cancelar" }
            }
        }).render(true);
    }

    async _onUpgradeStructure(event) {
        event.preventDefault();
        const card = event.currentTarget.closest('.structure-card');
        const index = card.dataset.index;
        const id = card.dataset.id;
        const d = this.actor.system.dominio;
        const structures = CONFIG.GOT.structures;
        const config = structures[id];

        if (!config) return;

        // Resolve leaders for Gestao bonus
        const findSpec = (specs, name) => {
            const normName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            for (let [key, val] of Object.entries(specs || {})) {
                const normKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (normKey === normName) return val;
            }
            return 0;
        };

        const hSenhor = game.actors.get(d.senhor)?.system.habilidades?.status || { especialidades: {} };
        const hAdmin = game.actors.get(d.castelao)?.system.habilidades?.status || { especialidades: {} };
        const gestao = findSpec(hAdmin.especialidades, "gestao") + findSpec(hSenhor.especialidades, "gestao");
        const costMod = 1 - (gestao * 0.05);

        let current = foundry.utils.duplicate(d.estruturas || []);
        const struct = current[index];
        const castle = current.find(s => s.id === "castelo_principal");
        const castleLevel = castle?.level || 0;

        if (!struct || struct.level >= (config.max_level || 5)) {
            return ui.notifications.warn(`"${config.name}" ja atingiu o nivel maximo (${config.max_level || 5})!`);
        }

        // Hegemony Check
        if (id !== "castelo_principal" && struct.level >= castleLevel) {
            return ui.notifications.warn(`Voce precisa aumentar o nivel do Castelo Principal (Nvl ${castleLevel}) antes de evoluir esta estrutura!`);
        }

        // Cost verification
        const updates = {};
        for (let [res, amt] of Object.entries(config.cost || {})) {
            const totalCost = Math.ceil((amt * (struct.level + 1)) * costMod);
            if ((d[res] || 0) < totalCost) {
                return ui.notifications.warn(`Recurso insuficiente: ${res.charAt(0).toUpperCase() + res.slice(1)}!`);
            }
            updates[`system.dominio.${res}`] = (d[res] || 0) - totalCost;
        }

        struct.level += 1;
        updates["system.dominio.estruturas"] = current;

        await this.actor.update(updates);
        ui.notifications.info(`${config.name} evoluido para Nivel ${struct.level}!`);
    }

    async _onDemolishStructure(event) {
        event.preventDefault();
        const index = event.currentTarget.closest('.structure-card').dataset.index;
        const d = this.actor.system.dominio;
        let current = foundry.utils.duplicate(d.estruturas || []);

        if (current[index]) {
            current.splice(index, 1);
            await this.actor.update({ "system.dominio.estruturas": current });
        }
    }

    async _onAdvanceMonth(event) {
        event.preventDefault();
        const context = await this.getData();
        const net = context.netYields;
        const i = context.infraBonus;
        const m = context.maintenance;
        const d = this.actor.system.dominio;

        const updates = {
            "system.dominio.fortuna": (d.fortuna || 0) + net.fortuna,
            "system.dominio.comida": (d.comida || 0) + net.comida,
            "system.dominio.poder": (d.poder || 0) + net.poder,
            "system.dominio.influencia": (d.influencia || 0) + net.influencia,
            "system.dominio.defesa": (d.defesa || 0) + net.defesa
        };

        await this.actor.update(updates);

        // Chat Message Summary
        let chatContent = `<div class="got-chat-card">
            <header class="card-header">
                <img src="${this.actor.img}" width="36" height="36"/>
                <h3>Rendimentos Mensais: ${this.actor.name}</h3>
            </header>
            <div class="card-content">
                <p>O tempo passou e as infraestruturas geraram rendimentos liquidos:</p>
                <ul style="list-style: none; padding: 0;">
                    <li>💰 <b>Fortuna:</b> +${net.fortuna} (Total: ${updates["system.dominio.fortuna"]})</li>
                    <li>🌾 <b>Comida:</b> +${i.comida} Ganhos | -${m.comida} Manutencao | <b>Saldo: ${net.comida >= 0 ? "+" : ""}${net.comida}</b></li>
                    <li>⚔️ <b>Poder:</b> +${net.poder} (Total: ${updates["system.dominio.poder"]})</li>
                    <li>👑 <b>Influencia:</b> +${net.influencia} (Total: ${updates["system.dominio.influencia"]})</li>
                    <li>🛡️ <b>Defesa:</b> +${net.defesa} (Total: ${updates["system.dominio.defesa"]})</li>
                </ul>
                <p style="font-size: 0.8em; color: #666; margin-top: 10px;">Nota: Ordem Publica nao aumenta automaticamente, depende de eventos ou estabilidade.</p>
            </div>
        </div>`;

        ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: chatContent
        });

        ui.notifications.info(`Mes avancado! Recursos e manutencao processados para ${this.actor.name}.`);
    }

    async _onRoll(event) {
        event.preventDefault();
        const dataset = event.currentTarget.dataset;
        console.log("GOT | Rolar clicado:", dataset.label, "Formula:", dataset.roll, "Ability:", dataset.ability);

        if (dataset.roll) {
            let roll = new Roll(dataset.roll, this.actor.getRollData());
            await roll.evaluate(); // V12 requirement

            let flavor = dataset.label ? `<b>Rola ${dataset.label}</b>` : '';

            // Intrigue/Combat Automation for basic rolls
            if (dataset.ability) {
                const combat = this._calculateCombatResult(roll.total, dataset.ability);
                if (combat) {
                    const degrees = Math.max(1, combat.degrees);

                    flavor += `<hr><b>Alvo:</b> ${combat.targetName}`;
                    const defLabel = combat.isIntrigue ? "Defesa Intriga" : "Defesa Combate";
                    flavor += `<br>${defLabel}: ${combat.defense} | Margem: ${combat.margin >= 0 ? "+" : ""}${combat.margin}`;

                    if (combat.margin >= 0) {
                        flavor += `<br>Graus de Sucesso: <b>${degrees}</b>`;

                        // Intrigue Influence Calculation (Rank + Degrees)
                        if (combat.isIntrigue) {
                            const abilityRank = this.actor.system.habilidades[dataset.ability]?.base || 2;
                            const influence = abilityRank + degrees;
                            flavor += `<br>Influencia: <b>${influence}</b> (Rank ${abilityRank} + ${degrees} Graus)`;
                        }
                    } else {
                        flavor += `<br><span style="color:red">Falha!</span>`;
                    }
                }
            }

            await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor: flavor });
        }
    }

    _calculateTargetStats(actor) {
        // IMPROVED: Check both actor.type and system.tipo_ficha to ensure units are recognized correctly
        if (actor.type === "unit" || actor.system?.tipo_ficha === "unit") {
            const m = actor.system.militar;
            const getVal = (k, def) => {
                return Number(m[k] || def) + Number(m.pontos?.[k] || 0);
            };
            const agi = getVal("agilidade", 2);
            const atl = getVal("atletismo", 2);
            const per = getVal("percepcao", 2);
            const defense = agi + atl + per + parseInt(m.bonus_defesa || 0);

            // Unit AR: Training Level x 3
            const normTr = (m.treinamento || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let arBase = 0;
            if (normTr.includes("treinado")) arBase = 3;
            else if (normTr.includes("veterano")) arBase = 6;
            else if (normTr.includes("elite")) arBase = 9;
            const ar = arBase + parseInt(m.bonus_armadura || 0);

            return { defense, intrigueDefense: 0, ar, actorId: actor.id };
        } else {
            // Character
            const h = actor.system.habilidades;
            const agi = h.agilidade?.base || 2;
            const atl = h.atletismo?.base || 2;
            const per = h.percepcao?.base || 2;
            const ast = h.astucia?.base || 2;
            const sta = h.status?.base || 2;

            // Calc Items
            let totalAR = 0;
            let totalShield = 0;
            let totalAP = 0;

            actor.items.forEach(i => {
                const s = i.system;
                if ((s.type === 'armadura' || s.type === 'escudo') && s.uso) {
                    if (s.ar) totalAR += parseInt(s.ar);
                    // AP logic: strictly additive if stored as negative, but we need to check if user meant "Penalty Value" (positive) or "Modifier" (negative).
                    // Based on previous code "totalAP += Number(i.system.ap || 0)", allowing negative values in the item sheet is standard.
                    if (s.ap) totalAP += parseInt(s.ap);
                    if (s.defesa_bonus) totalShield += parseInt(s.defesa_bonus);
                }
            });

            const defense = agi + atl + per + totalShield + totalAP;
            const intrigueDefense = per + ast + sta;

            return { defense, intrigueDefense, ar: totalAR };
        }
    }

    _calculateCombatResult(rollTotal, rollType = "combat") {
        const targets = game.user.targets;
        if (!targets || targets.size === 0) return null;

        const target = targets.first();
        const targetActor = target.actor;
        if (!targetActor) return null;

        const stats = this._calculateTargetStats(targetActor);

        let targetDefense = stats.defense;
        let targetAR = stats.ar;
        let isIntrigue = false;

        // Check if Intrigue Roll
        if (["persuasao", "enganacao", "status", "intriga"].includes(rollType)) {
            targetDefense = stats.intrigueDefense;
            targetAR = 0; // No armor in intrigue
            isIntrigue = true;
        }

        const margin = rollTotal - targetDefense;
        let degrees = 0;
        if (margin >= 0) {
            // SIFRP Standard: 15+ margin = 4 Degrees (Impressive Success)
            degrees = Math.min(4, 1 + Math.floor(margin / 5));
        }

        return {
            targetName: target.name,
            targetId: targetActor.id,
            targetType: targetActor.system.tipo_ficha || "character",
            defense: targetDefense,
            margin: margin,
            degrees: degrees,
            ar: targetAR,
            isIntrigue
        };
    }

    /* Deprecated - Replaced by expanded version below */
    _calculateCombatResult_OLD(rollTotal) {
        const targets = game.user.targets;
        if (!targets || targets.size === 0) return null;

        const target = targets.first();
        const targetActor = target.actor;
        if (!targetActor) return null;

        let defense = 0;

        if (targetActor.type === "unit") {
            const m = targetActor.system.militar;
            const getVal = (k) => {
                // Hardcoded fallback logic since CONFIG is external
                const baseParams = CONFIG.GOT.unitBaseStats?.[m.tipo] || CONFIG.GOT.unitBaseStats?.["Infantaria"] || {};
                let val = (m[k] !== undefined && m[k] !== null) ? parseInt(m[k]) : (baseParams[k] || 2);
                if (m.pontos && m.pontos[k]) val += parseInt(m.pontos[k]);
                return val;
            };
            defense = getVal("agilidade") + getVal("atletismo") + getVal("percepcao");
        } else {
            defense = targetActor.system.combate_intriga?.defesa || 0;
        }

        const margin = rollTotal - defense;
        let degrees = 0;
        if (margin >= 0) {
            degrees = 1 + Math.floor(margin / 5);
        }

        return {
            targetName: target.name,
            defense: defense,
            margin: margin,
            degrees: degrees
        };
    }
}

// Hook into Foundry initialization
Hooks.once('init', async function () {
    console.log('GOT | Initializing Game of Thrones Universal Sheet');

    // Preload templates/partials
    await loadTemplates([
        "modules/got-character-sheet/templates/family-tree-app.hbs",
        "modules/got-character-sheet/templates/partials/tree-node-recursive.hbs"
    ]);

    Handlebars.registerHelper('ne', (a, b) => a !== b);
    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('add', (a, b) => a + b);
    Handlebars.registerHelper('multiply', (a, b) => a * b);

    // unregister default worldbuilding sheet if it exists
    Actors.unregisterSheet("worldbuilding", ActorSheet, { types: ["character"] });

    // Register our sheet as default for worldbuilding system actors
    Actors.registerSheet("worldbuilding", GOTActorSheet, {
        types: ["character", "npc", "unit", "feud"],
        makeDefault: true,
        label: "Ficha de Cr\u00f4nicas de Gelo e Fogo"
    });

    CONFIG.GOT = {
        habilidades: {
            agilidade: "Agilidade", lidar_com_animais: "Lidar com Animais", atletismo: "Atletismo", percepcao: "Percep\u00e7\u00e3o",
            astucia: "Ast\u00facia", enganacao: "Engana\u00e7\u00e3o", resistencia: "Resist\u00eancia", luta: "Luta", cura: "Cura", idioma: "Idioma",
            conhecimento: "Conhecimento", pontaria: "Pontaria", persuasao: "Persuas\u00e3o", status: "Status",
            furtividade: "Furtividade", sobrevivencia: "Sobreviv\u00eancia", guerra: "Guerra", vontade: "Vontade"
        },
        defaultData: {
            tipo_ficha: "character",
            info: { nome: "", casa: "", idade: 0, genero: "", pontos_destino: 0 },
            habilidades: {
                agilidade: { base: 2, especialidades: { acrobacia: 0, equilibrio: 0, contorcionismo: 0, esquiva: 0, rapidez: 0 } },
                lidar_com_animais: { base: 2, especialidades: { encantar: 0, conduzir: 0, montar: 0, treinar: 0 } },
                atletismo: { base: 2, especialidades: { escalar: 0, saltar: 0, correr: 0, forca: 0, nadar: 0, arremessar: 0 } },
                percepcao: { base: 2, especialidades: { empatia: 0, notar: 0 } },
                astucia: { base: 2, especialidades: { decifrar: 0, logica: 0, memoria: 0 } },
                enganacao: { base: 2, especialidades: { atuar: 0, blefar: 0, disfarce: 0 } },
                resistencia: { base: 2, especialidades: { resiliencia: 0, vigor: 0 } },
                luta: { base: 2, especialidades: { machados: 0, macas: 0, esgrima: 0, laminas_longas: 0, armas_de_haste: 0, escudos: 0, laminas_curtas: 0, lancas: 0, desarmado: 0 } },
                cura: { base: 2, especialidades: { diagnosticar: 0, tratar_ferimentos: 0, tratar_doencas: 0 } },
                idioma: { base: 2, dialeto: "" },
                conhecimento: { base: 2, especialidades: { educacao: 0, pesquisa: 0, mapas: 0 } },
                pontaria: { base: 2, especialidades: { arcos: 0, bestas: 0, fundas: 0, armas_de_arremesso: 0 } },
                persuasao: { base: 2, especialidades: { barganhar: 0, encantar: 0, convencer: 0, incitar: 0, intimidar: 0, seduzir: 0, provocar: 0 } },
                status: { base: 2, especialidades: { linhagem: 0, reputacao: 0, gestao: 0, torneios: 0 } },
                furtividade: { base: 2, especialidades: { misturar_se: 0, ladinagem: 0, esgueirar_se: 0 } },
                sobrevivencia: { base: 2, especialidades: { forragear: 0, orientacao: 0, rastrear: 0 } },
                guerra: { base: 2, especialidades: { comando: 0, ["estrat\u00e9gia"]: 0, ["t\u00e1tica"]: 0 } },
                vontade: { base: 2, especialidades: { coordenar: 0, coragem: 0, dedicacao: 0 } }
            },
            combate_intriga: { ferimentos: { value: 0, max: 5 }, lesoes: { value: 0, max: 5 }, frustracao: { value: 0, max: 5 }, estresse: { value: 0, max: 5 }, saude: { value: 6, max: 6 }, defesa: 6, esforco: { value: 2, max: 2 }, esforco_ativo: false, sacrificar_bonus: false },
            biografia: "",
            linhagem: { pai: "", mae: "", conjuge: "", irmaos: [], filhos: [] },
            relacoes: { slots: Array.from({ length: 12 }, () => ({ id: "", type: "friend" })) },
            controles: []
        },
        defaultUnitData: { poder: 0, saude: { value: 0, max: 0 }, disciplina: 0, armadura: 0, movimento: 0, luta: 0, pontaria: 0, tipo: "Infantaria", treinamento: "Recruta", tamanho: "Unidade (100)", vigor: 0, notas: "", manobras_personalizadas: "", comandante: "", subcomandante: "", agilidade: 0, atletismo: 0, percepcao: 0, pontos: {} },
        defaultFeudData: { fortuna: 20, poder: 20, lei: 20, populacao: 20, influencia: 20, defesa: 20, ordem_publica: 100, comida: 20, estruturas: [], max_estruturas_base: 5, senhor: "", castelao: "", chefe_militar: "", notas: "" },

        // Base Stats by Unit Type (User Request)
        unitBaseStats: {
            "Infantaria": { luta: 3, agilidade: 2, atletismo: 3, disciplina: 2, pontaria: 1, movimento: 3, poder: 1, percepcao: 2 },
            "Piqueiros": { luta: 4, agilidade: 2, atletismo: 3, disciplina: 3, pontaria: 1, movimento: 3, poder: 2, percepcao: 2 },
            "Espadachim": { luta: 4, agilidade: 3, atletismo: 3, disciplina: 3, pontaria: 1, movimento: 4, poder: 2, percepcao: 3 },
            "Arqueiros": { luta: 1, agilidade: 3, atletismo: 2, disciplina: 2, pontaria: 4, movimento: 4, poder: 1, percepcao: 3 },
            "Cavalaria": { luta: 4, agilidade: 3, atletismo: 4, disciplina: 3, pontaria: 1, movimento: 6, poder: 3, percepcao: 2 },
            "Armas de Cerco": { luta: 1, agilidade: 1, atletismo: 4, disciplina: 4, pontaria: 3, movimento: 1, poder: 5, percepcao: 1 },
            "Naval": { luta: 3, agilidade: 2, atletismo: 3, disciplina: 3, pontaria: 3, movimento: 5, poder: 2, percepcao: 2 },
            "Elefante": { luta: 5, agilidade: 2, atletismo: 5, disciplina: 4, pontaria: 1, movimento: 5, poder: 5, percepcao: 2 },
            "Campones": { luta: 2, agilidade: 2, atletismo: 2, disciplina: 1, pontaria: 1, movimento: 3, poder: 1, percepcao: 2 },
            "Arqueiros Montados": { luta: 2, agilidade: 3, atletismo: 3, disciplina: 2, pontaria: 4, movimento: 6, poder: 2, percepcao: 3 }
        },

        structures: {
            castelo_principal: { name: "Castelo Principal", desc: "A sede do poder. Onde o senhor reside e governa. Necessario para evoluir outras estruturas.", cost: { fortuna: 40, poder: 10 }, bonus: { max_estruturas: 1, populacao: 150, influencia: 10, defesa: 10 } },
            centro_urbano: { name: "Centro Urbano", desc: "Coracao da cidade. Define limites de expansao.", cost: { fortuna: 15 }, bonus: { max_estruturas: 3, populacao: 3000, soldados: 50 } },
            fazenda: { name: "Fazenda", desc: "Producao basica de cereais e vegetais.", cost: { fortuna: 5 }, bonus: { comida: 15 } },
            celeiro: { name: "Celeiro", desc: "Armazena e gera graos.", cost: { fortuna: 5 }, bonus: { comida: 5 } },
            mercado: { name: "Mercado", desc: "Aumenta o comercio local.", cost: { fortuna: 10 }, bonus: { fortuna: 5 } },
            prisao: { name: "Prisoes", desc: "Mantem criminosos longe das ruas.", cost: { fortuna: 10, poder: 5 }, bonus: { ordem: 30 } },
            estalagem: { name: "Estalagem", desc: "Melhora o moral com lazer.", cost: { fortuna: 5, poder: 2 }, bonus: { ordem: 15 } },
            teatro: { name: "Teatro", desc: "Cultura e entretenimento para o povo.", cost: { fortuna: 15, poder: 5 }, bonus: { ordem: 25, influencia: 2 }, req: { gestao: 1, torneios: 1 } },
            coliseu: { name: "Coliseu", desc: "Grandes jogos e demonstracoes de gloria.", cost: { fortuna: 30, poder: 15 }, bonus: { ordem: 40, poder: 5, influencia: 5 }, req: { torneios: 3 } },
            quartel: { name: "Quartel", desc: "Treinamento e alojamento de tropas.", cost: { fortuna: 15, poder: 10 }, bonus: { poder: 10, defesa: 20, soldados: 40 } },
            oficina: { name: "Oficina de Cerco", desc: "Engenharia para armas de cerco e reparos.", cost: { fortuna: 20, poder: 5 }, bonus: { defesa: 5 } },
            ferreiro: { name: "Ferreiro", desc: "Equipa tropas com aco de qualidade.", cost: { fortuna: 15, poder: 5 }, bonus: { defesa: 3, fortuna: 1 } },
            porto: { name: "Porto", desc: "Comercio maritimo e construcao naval.", cost: { fortuna: 25 }, bonus: { fortuna: 5, comida: 2 } },
            coutada: { name: "Coutada de Caca", desc: "Producao de carne e recursos silvestres.", cost: { fortuna: 5 }, bonus: { comida: 3 } },
            caserna: { name: "Caserna", desc: "Melhora a ordem atraves da guarda.", cost: { fortuna: 10, poder: 5 }, bonus: { ordem: 20 } },
            acampamento: { name: "Acampamento", desc: "Aumenta a capacidade de manter tropas em campo.", cost: { fortuna: 5, poder: 2 }, bonus: { soldados: 2500 } },
            estabulo: { name: "Estabulo", desc: "Cria infraestrutura para cavalos e montarias.", cost: { fortuna: 10, poder: 5 }, bonus: { poder: 5, defesa: 10, soldados: 20 } },

            // BONUS BUILDINGS (Gestao 3+)
            grande_biblioteca: { name: "Grande Biblioteca", desc: "Centro de saber e prestigio.", cost: { fortuna: 20, poder: 10 }, bonus: { influencia: 15 }, req: { gestao: 3 } },
            guilda_mercadores: { name: "Guilda de Mercadores", desc: "Associacao comercial para gerar riqueza.", cost: { fortuna: 30 }, bonus: { fortuna: 20 }, req: { gestao: 3 } },
            academia_militar: { name: "Academia Militar", desc: "Elite do treinamento militar.", cost: { fortuna: 30, poder: 20 }, bonus: { defesa: 5, soldados: 100 }, req: { gestao: 3 } },
            muralha: { name: "Muralha", desc: "Fortificacao defensiva que protege o feudo.", cost: { fortuna: 15, poder: 5 }, bonus: { defesa: 5, vida_muralha: 10 } },
            esconderijo_espioes: { name: "Esconderijo dos Espioes", desc: "Centro de inteligencia para recrutamento de agentes e protecao interna.", cost: { fortuna: 20, poder: 5 }, bonus: { influencia: 5, ordem: 10 }, req: { gestao: 2 } },
            mina_ouro: { name: "Mina de Ouro", desc: "Exploracao de veios de metal precioso para financiar o reino.", cost: { fortuna: 40 }, bonus: { fortuna: 20 }, req: { gestao: 3 } },
            academia: { name: "Academia", desc: "Instituicao de ensino superior para formacao de burocratas e academicos.", cost: { fortuna: 25, poder: 5 }, bonus: { influencia: 10, fortuna: 2 }, req: { gestao: 4 } },
            mina_ferro: { name: "Mina de Ferro", desc: "Extracao de minerio de ferro para impulsionar a economia e a forja de armas.", cost: { fortuna: 25, poder: 5 }, bonus: { fortuna: 10, poder: 5, defesa: 2 } },
            vinhedo: { name: "Vinhedo", desc: "Producao de vinhos finos que geram grande riqueza e prestigio para a casa.", cost: { fortuna: 20 }, bonus: { fortuna: 12, influencia: 2 } },
            pomar: { name: "Pomar", desc: "Cultivo de frutas diversas, garantindo suprimentos e um pequeno lucro comercial.", cost: { fortuna: 10 }, bonus: { comida: 10, fortuna: 2 } },
            casa_escravos: { name: "Casa dos Escravos", desc: "Onde os trabalhadores forcados de guerra vao ficar. Centraliza a mao de obra cativa, expandindo a capacidade produtiva e diminuindo a insatisfacao geral atraves do trabalho compulsorio organizado.", cost: { fortuna: 15, poder: 10 }, bonus: { fortuna: 15, populacao: 1000 } },
            templo: { name: "Templo", desc: "Local sagrado para contemplacao religiosa (Septos, Bosques Sagrados, Templos). Promove a paz espiritual e a ordem social entre os habitantes.", cost: { fortuna: 15, poder: 5 }, bonus: { ordem: 20, influencia: 5, fortuna: 5 } }
        }
    };
});

// --- COMBAT HUD (MERGED) ---

/**
 * GOTCombatHUD
 * A stylized battle HUD for chronicling Game of Thrones (SIFRP) in Foundry VTT.
 */
class GOTCombatHUD extends Application {
    constructor(options = {}) {
        super(options);
        this.activeToken = null;
        this.enabled = game.settings.get("got-character-sheet", "hudEnabled");
        console.log("GOT | HUD Status on Init:", this.enabled);
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "got-combat-hud",
            classes: ["got-hud-app", "got-hud-window-clean"],
            template: "modules/got-character-sheet/templates/combat-hud.hbs",
            popOut: true,
            minimizable: false,
            resizable: false,
            draggable: false,
            width: 1000,
            height: 260
        });
    }

    render(force = false, options = {}) {
        if (!this.enabled && !force) {
            this.close();
            return;
        }
        console.log("GOT | Rendering Combat HUD", { enabled: this.enabled, token: this.activeToken?.name });
        return super.render(force, options);
    }

    getData() {
        if (!this.activeToken) return {};
        const actor = this.activeToken.actor;
        if (!actor) return {};

        // Determine if it is a Unit
        const isUnit = actor.system.tipo_ficha === "unit";

        const system = actor.system;

        // Safety guards for SIFRP data structure
        let health, effort;
        let activeMount = null;
        let mountHealthPct = 0;
        if (isUnit) {
            const m = system.militar || {};

            // Recalculate max health for HUD (matches _prepareUnitData logic)
            const sizeHealthMap = { "Pelotao (10)": 0, "Unidade (100)": 10, "Batalhao (500)": 25, "Legiao (1000)": 50 };
            const sizeBonus = Number(sizeHealthMap[m.tamanho || "Pelotao (10)"] || 0);
            const disc = Number(m.disciplina || 2);

            const saudeMax = Math.max(1, (disc * 3) + sizeBonus);
            const saudeVal = Number(m.saude?.value ?? saudeMax);

            health = { value: saudeVal, max: saudeMax };

            // For Moral (Units use Vigor as Max and moral points as current)
            const vigorMax = Math.max(1, Number(m.vigor || 2));
            const moralVal = (m.moral !== undefined) ? Number(m.moral) : vigorMax;

            effort = { value: moralVal, max: vigorMax };

            console.log(`GOT HUD | Unit Stats Debug: Health=${health.value}/${health.max}, Moral=${effort.value}/${effort.max}`);

        } else {
            health = system?.combate_intriga?.saude || { value: 0, max: 0 };
            effort = system?.combate_intriga?.esforco || { value: 0, max: 0 };
            
            // Explicitly Clear Mount Data for Non-Unit characters before detection
            activeMount = null;
            mountHealthPct = 0;
        }

        const healthPct = health.max > 0 ? Math.min(100, (health.value / health.max) * 100) : 0;
        const effortPct = effort.max > 0 ? Math.min(100, (effort.value / effort.max) * 100) : 0;

        // Movement Data (Energy Bar)
        let moveBase = Number(system.combate_intriga?.movimento || 0);

        // Character fallback: calculate movement from bulk if not unit
        // Character fallback: calculate movement from bulk if not unit
        if (!isUnit) {
            let totalBulk = 0;
            actor.items.forEach(i => {
                const s = i.system;
                const type = s?.type || i.type;
                if (type === 'arma') {
                    totalBulk += Number(s.bulk || 0);
                } else if (type === 'armadura' || type === 'escudo') {
                    if (s.uso) totalBulk += Number(s.bulk || 0);
                }
            });
            moveBase = Math.max(1, 4 - totalBulk);

            // Mount logic for Characters
            const mount = actor.items?.find(i => i.system?.type === "montaria" && i.system?.uso === true);
            if (mount && mount.system) {
                // Parse movement - ensure it's at least 4
                moveBase = Number(mount.system.movimento || 4);
                activeMount = mount;
                mountHealthPct = Math.min(100, Math.max(0, (mount.system.saude.value / mount.system.saude.max) * 100));
            } else {
                activeMount = null;
                mountHealthPct = 0;
            }
        } else {
            // Unit movement is directly squares or base
            moveBase = Number(system.militar?.movimento || 1);
        }

        const isSprinting = system.combate_intriga?.sprint_ativo === true;
        const moveTotal = isSprinting ? moveBase * 4 : moveBase;

        // Virtual attacks for Units or Items for Characters
        let attacks = [];
        if (isUnit) {
            attacks = [
                { id: "unit-luta", name: "Luta (Tropa)", img: "/icons/svg/sword.svg", isUnitRoll: true, stat: "luta", label: "Luta" },
                { id: "unit-pontaria", name: "Pontaria (Tropa)", img: "/icons/svg/target.svg", isUnitRoll: true, stat: "pontaria", label: "Pontaria" }
            ];
        } else {
            // Detect weapons using system.type fallback
            const weapons = actor.items?.filter(i => i.system?.type === "arma") || [];
            attacks = weapons.map(w => {
                const sys = w.system;
                const attrKey = sys.atributo_dano || "atletismo";
                const attrVal = attrKey === "nenhum" ? 0 : (actor.system.habilidades[attrKey]?.base || 0);
                const baseDmg = Number(sys.dano || 0);
                return {
                    id: w.id,
                    name: w.name,
                    img: w.img,
                    damage: baseDmg + attrVal
                };
            });
        }

        // Fetch distance moved from token flag (now tracked in Squares/qd)
        const distanceMovedSquares = this.activeToken.document.getFlag("got-character-sheet", "distanciaMovida") || 0;

        // Active Tab Persistence (Instance property > Actor flag > Default)
        if (!this.activeTab) {
            const flagTab = this.activeToken?.actor?.getFlag("got-character-sheet", "activeHudTab");
            this.activeTab = ["ataque", "manobras", "poderes", "vitais", "destino"].includes(flagTab) ? flagTab : "ataque";
        }

        // Square capacity calculation
        let moveSquaresTotal;
        if (isUnit) {
            moveSquaresTotal = moveBase; // 1:1 for Units
        } else {
            // SIFRP: 1 Square = 1.5 meters.
            const moveSquaresBase = Math.round(moveBase / 1.5);
            const moveSquaresSprint = Math.round((moveBase * 4) / 1.5);
            moveSquaresTotal = isSprinting ? moveSquaresSprint : moveSquaresBase;
        }

        const moveSquaresRemainingNum = Math.max(0, (moveSquaresTotal - distanceMovedSquares));
        const moveSquaresRemaining = Math.max(0, moveSquaresRemainingNum).toFixed(1);
        const movePct = moveSquaresTotal > 0 ? Math.min(100, (moveSquaresRemainingNum / moveSquaresTotal) * 100) : 0;

        console.log(`GOT HUD | Movement Debug: Total=${moveSquaresTotal}, Moved=${distanceMovedSquares.toFixed(2)}, Remaining=${moveSquaresRemainingNum.toFixed(2)}, Pct=${movePct}%`);

        const maneuvers = [
            // Menores
            { id: "ajudar", name: "Ajudar", icon: "fas fa-hands-helping", type: "menor" },
            { id: "interagir", name: "Interagir", icon: "fas fa-hand-pointer", type: "menor" },
            { id: "levantar", name: "Levantar/Cair", icon: "fas fa-long-arrow-alt-up", type: "menor" },
            { id: "mover", name: "Mover-se", icon: "fas fa-walking", type: "menor" },
            // Maiores
            { id: "carga", name: "Carga", icon: "fas fa-horse", type: "maior", ability: "atletismo", spec: "corrida" },
            { id: "corrida", name: "Corrida", icon: "fas fa-running", type: "maior", ability: "atletismo", spec: "corrida" },
            { id: "derrubar", name: "Derrubar", icon: "fas fa-user-slash", type: "Luta", typeAction: "maior", ability: "luta", spec: "briga" },
            { id: "desarmar", name: "Desarmar", icon: "fas fa-hand-paper", type: "Luta", typeAction: "maior", ability: "luta" },
            { id: "esquiva", name: "Esquiva", icon: "fas fa-shield-alt", type: "Agilidade", typeAction: "maior", ability: "agilidade", spec: "esquiva" },
            { id: "fintar", name: "Fintar", icon: "fas fa-mask", type: "Enganacao", typeAction: "maior", ability: "enganacao", spec: "astucia" },
            { id: "imobilizar", name: "Imobilizar", icon: "fas fa-anchor", type: "Atletismo", typeAction: "maior", ability: "atletismo", spec: "forca" },
            { id: "passar", name: "Passar", icon: "fas fa-hourglass-half", type: "maior" },
            { id: "puxar_cavaleiro", name: "Puxar Cavaleiro", icon: "fas fa-user-injured", type: "Luta", typeAction: "maior", ability: "atletismo", spec: "forca" },
            { id: "recuperar_folego", name: "Recuperar Folego", icon: "fas fa-heartbeat", type: "Vigor", typeAction: "maior", ability: "vigor" },
            { id: "atq_duas_armas", name: "Atq. 2 Armas", icon: "fas fa-sword", type: "maior" }
        ];

        let mountedActions = [];
        if (activeMount) {
            mountedActions.push({ id: "atq_montado", name: "Atq. Montado", icon: "fas fa-horse-head", type: "maior", ability: "luta" });
            mountedActions.push({ id: "pisotear", name: "Pisotear", icon: "fas fa-paw", type: "maior", ability: "lidar_com_animais", spec: "montar" });
            mountedActions.push({ id: "carga_montada", name: "Carga Montada", icon: "fas fa-horse-head", type: "maior", ability: "luta", isActive: !!actor.getFlag("got-character-sheet", "charging") });
        }

        // Items and Info - Correcting type filter for Qualities
        const qualities = actor.items?.filter(i => i.system?.type === "qualidade") || [];

        // Dynamic Destiny Point Management: Spent vs Burned
        let destinyCurrent = Number(system.info?.pontos_destino || 0);
        let destinyMax = Number(system.info?.pontos_destino_max);

        // If max is missing or somehow corrupted, default to current
        if (isNaN(destinyMax) || destinyMax === 0) destinyMax = destinyCurrent;

        // Safety: max should never be less than current unless points were burned
        // But here we just ensure we show the saved max if it exists

        return {
            actor: actor,
            token: this.activeToken,
            system: system,
            healthPct,
            effortPct,
            healthValue: health.value,
            effortValue: effort.value,
            attacks,
            maneuvers,
            mountedActions,
            qualities,
            destinyCurrent,
            destinyMax,
            isCombat: !!game.combat,
            isUnit: isUnit,
            moveSquaresTotal,
            moveSquaresRemaining,
            movePct,
            activeTab: this.activeTab,
            activeMount: activeMount,
            hasMount: !!activeMount,
            mountHealthPct: mountHealthPct,
            isCharging: !!actor.getFlag("got-character-sheet", "charging")
        };
    }

    updateToken(token) {
        this.activeToken = token;
        if (token && this.enabled) this.render(true);
        else this.close();
    }

    async toggle() {
        this.enabled = !this.enabled;
        await game.settings.set("got-character-sheet", "hudEnabled", this.enabled);

        if (this.enabled && canvas.tokens.controlled.length > 0) {
            this.updateToken(canvas.tokens.controlled[0]);
        } else {
            this.close();
        }
        ui.notifications.info(`Combat HUD ${this.enabled ? "Ativado" : "Desativado"}. (Tecla K)`);

        if (ui.controls) ui.controls.render();
    }

    activateListeners(html) {
        super.activateListeners(html);

        // HUD Draggable Logic
        const hudElement = html.find('.got-hud');
        if (hudElement.length) {
            new Draggable(this, html, hudElement[0], false);
        }

        // Tab Switching
        html.find('.hud-tab-btn').click(async ev => {
            const tab = ev.currentTarget.dataset.tab;
            this.activeTab = tab;
            if (this.activeToken?.actor) {
                await this.activeToken.actor.setFlag("got-character-sheet", "activeHudTab", tab);
            }
            this.render();
        });

        html.find('.hud-weapon').click(async ev => {
            if (game.user.targets.size === 0) return ui.notifications.warn("Selecione um alvo (T) primeiro!");
            const itemId = ev.currentTarget.dataset.itemId;
            const actor = this.activeToken.actor;
            const sheet = (actor.sheet && actor.sheet instanceof GOTActorSheet) ? actor.sheet : new GOTActorSheet(actor);
            sheet.rollWeapon(itemId);
        });

        html.find('.hud-maneuver').click(async ev => {
            const data = ev.currentTarget.dataset;
            const actor = this.activeToken.actor;
            if (!actor) return;
            
            const actionId = (data.id || "").toLowerCase().trim();
            const actionName = (data.name || "").toLowerCase().trim();

            // 1. ESPECIAL: CARGA MONTADA (Toggle)
            if (actionId.includes("carga_montada") || actionName.includes("carga montada")) {
                const current = actor.getFlag("got-character-sheet", "charging") || false;
                await actor.setFlag("got-character-sheet", "charging", !current);
                if (!current) {
                    ui.notifications.info(`${actor.name} está preparando uma Carga Montada (+2 Dano no próximo ataque)!`);
                }
                this.render();
                return;
            }

            // 2. ESPECIAL: PISOTEAR (Rolo de Ataque)
            if (actionId === "pisotear" || actionName.includes("pisotear")) {
                const mount = actor.items?.find(i => i.system?.type === "montaria" && i.system?.uso === true);
                if (!mount) return ui.notifications.warn("Você não tem uma montaria ativa!");

                const ability = actor.system.habilidades?.lidar_com_animais?.base || 2;
                let specBonus = 0;
                const specs = actor.system.habilidades?.lidar_com_animais?.especialidades || {};
                
                // Normalization for specializations
                for (let [k, v] of Object.entries(specs)) {
                    if (k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("montar")) {
                        specBonus = v;
                        break;
                    }
                }
                
                const roll = new Roll(`${ability + specBonus}d6kh${ability}`);
                await roll.evaluate();
                
                const dmgValue = mount.system?.ataques?.pisotear?.dano || 2;
                const attrVal = actor.system.habilidades?.atletismo?.base || 2;

                let content = `
                    <div class="got-hud-card weapon-card">
                        <header class="card-header">
                            <img src="${mount.img}" title="${mount.name}"/>
                            <h3 style="color:#ffd700;">Pisotear (${mount.name})</h3>
                        </header>
                        <div class="card-content">
                            <p><b>Teste de Lidar com Animais (Montar):</b> ${roll.total}</p>
                            <p><b>Dano:</b> ${dmgValue + attrVal}</p>
                            <hr>
                            <small style="font-style:italic; color:#ccc;">Alvo deve ser bem-sucedido num teste de Agilidade (Acrobacia) para não ficar Caído.</small>
                        </div>
                    </div>`;

                ChatMessage.create({
                    user: game.user.id,
                    speaker: ChatMessage.getSpeaker({ actor: actor }),
                    content: content,
                    rolls: [roll],
                    type: CONST.CHAT_MESSAGE_TYPES.ROLL
                });
                return;
            }

            // 3. ESPECIAL: ATAQUE MONTADO (Shortcut)
            if (actionId === "atq_montado" || actionName.includes("ataque montado")) {
                const weapons = actor.items.filter(i => i.system?.type === "arma");
                if (weapons.length === 1) {
                    const sheet = (actor.sheet && actor.sheet instanceof GOTActorSheet) ? actor.sheet : new GOTActorSheet(actor);
                    sheet.rollWeapon(weapons[0].id);
                } else if (weapons.length > 1) {
                    ui.notifications.info("Selecione qual arma usar na aba ATAQUE.");
                    this.activeTab = "ataque";
                    this.render();
                } else {
                    ui.notifications.warn("Nenhuma arma equipada para o Ataque Montado.");
                }
                return;
            }

            // 4. MANIPULAÇÃO DE MANOBRAS PADRÃO (Descrição no Chat)
            const descriptions = {
                "ajudar": "Concede +1D em um teste de um aliado ou +2 na Defesa dele ate o inicio do seu proximo turno. (Ação Menor)",
                "interagir": "Realizar tarefas simples como sacar uma arma ou montar em um cavalo. (Ação Menor)",
                "levantar": "Levantar-se do chao consome uma ação menor e não provoca ataques de oportunidade. (Ação Menor)",
                "mover": "Permite mover-se uma distância em quadrados igual a sua Graduação em Atletismo. (Ação Menor)",
                "carga": "Move-se e ataca. Recebe -1D no teste de Luta, mas soma +2 no Dano final. (Ação Maior)",
                "corrida": "Move-se uma distância igual a 4x sua Graduação em Atletismo. (Ação Maior)",
                "derrubar": "Teste de Atletismo ou Luta contra a Defesa do alvo para deixá-lo caído. (Ação Maior)",
                "desarmar": "Teste de Luta contra a Defesa do alvo para remover a arma das mãos dele. (Ação Maior)",
                "esquiva": "Realiza um teste de Agilidade. O resultado substitui sua Defesa até o proximo turno. (Ação Maior)",
                "fintar": "Teste de Enganação contra Defesa. Se vencer, ganha +1D no proximo ataque. (Ação Maior)",
                "imobilizar": "Tenta imobilizar o alvo, impedindo-o de agir livremente. (Ação Maior)",
                "passar": "Fica em guarda. Recebe +2B no proximo teste de ataque. (Ação Maior)",
                "puxar_cavaleiro": "Tenta derrubar o cavaleiro de sua montaria. (Ação Maior)",
                "recuperar_folego": "Teste de Vigor para recuperar 1 de Ferimento ou Esforço. (Ação Maior)",
                "atq_duas_armas": "Ataca com uma arma em cada mão aplicando penalidades. (Ação Maior)"
            };

            const desc = descriptions[actionId] || "Manobra de Combate: Realiza uma ação estratégica no campo de batalha.";
            
            ChatMessage.create({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: `
                    <div class="got-hud-card">
                        <header class="card-header">
                            <i class="fas fa-chess-knight" style="font-size: 1.5em; color: #d4af37; margin-right: 10px;"></i>
                            <h3 style="color:#ffd700; margin:0;">${data.name}</h3>
                        </header>
                        <div class="card-content" style="margin-top: 10px; font-size: 0.95em;">
                            ${desc}
                        </div>
                    </div>`
            });
        });


        // Qualities (Powers) - Send to Chat
        html.find('.hud-quality').click(async ev => {
            const itemId = ev.currentTarget.dataset.itemId;
            const item = this.activeToken.actor.items.get(itemId);
            if (!item) return;

            const content = `
                <div class="got-hud-card">
                    <header class="card-header">
                        <img src="${item.img}" width="36" height="36"/>
                        <h3>${item.name}</h3>
                    </header>
                    <div class="card-content">
                        ${item.system.description || "Sem descricao."}
                    </div>
                </div>
            `;

            ChatMessage.create({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: this.activeToken.actor }),
                content: content
            });
            ui.notifications.info(`Poder [${item.name}] enviado ao chat.`);
        });

        // Destiny Points - Spent vs Burned Logic
        html.find('.btn-destiny').click(async ev => {
            const action = ev.currentTarget.dataset.action;
            const actor = this.activeToken.actor;
            const currentDP = Number(actor.system.info?.pontos_destino || 0);
            let maxDP = Number(actor.system.info?.pontos_destino_max || currentDP);

            if (currentDP <= 0) return ui.notifications.error("Pontos de Destino insuficientes!");

            if (action === "spend") {
                const actualMax = Number(actor.system.info?.pontos_destino_max || maxDP);
                await actor.update({
                    "system.info.pontos_destino": Math.max(0, currentDP - 1),
                    "system.info.pontos_destino_max": actualMax
                });
                ui.notifications.info("Ponto de Destino Gasto! (Pode ser recuperado depois)");
            } else if (action === "burn") {
                const confirm = await Dialog.confirm({
                    title: "Queimar Ponto de Destino",
                    content: "<p>Tem certeza? Queimar um ponto de destino o remove <b>permanentemente</b> da ficha, reduzindo seu total maximo.</p>"
                });
                if (confirm) {
                    await actor.update({
                        "system.info.pontos_destino": Math.max(0, currentDP - 1),
                        "system.info.pontos_destino_max": Math.max(0, maxDP - 1)
                    });
                    ui.notifications.warn("Ponto de Destino QUEIMADO e removido permanentemente do seu total.");
                }
            }
            this.render();
        });

        html.find('.hud-unit-roll').click(async ev => {
            const actor = this.activeToken.actor;
            // Ensure we use the specialized unit roll method from the actor sheet
            const sheet = (actor.sheet && actor.sheet instanceof GOTActorSheet) ? actor.sheet : new GOTActorSheet(actor);
            sheet._onUnitRoll(ev);
        });

        // Manual Movement Reset
        html.find('.btn-reset-move').click(async ev => {
            const token = this.activeToken;
            if (token) {
                await token.document.setFlag("got-character-sheet", "distanciaMovida", 0);
                ui.notifications.info("Movimento resetado para este turno.");
                this.render();
            }
        });

        html.find('.hud-extra-attack').click(async ev => {
            if (game.user.targets.size === 0) return ui.notifications.warn("Selecione um alvo (T) primeiro!");

            const actor = this.activeToken.actor;
            const effort = actor.system.combate_intriga.esforco;

            if (effort.value <= 0) {
                return ui.notifications.error("Esforco insuficiente para Ataque Extra!");
            }

            await actor.update({ "system.combate_intriga.esforco.value": effort.value - 1 });
            ui.notifications.info(`Ataque Extra! Gastou 1 de Esforco (Restante: ${effort.value - 1})`);

            const sheet = (actor.sheet && actor.sheet instanceof GOTActorSheet) ? actor.sheet : new GOTActorSheet(actor);
            const weapons = actor.items?.filter(i => i.system?.type === "arma") || [];

            if (weapons.length === 0) {
                const formula = `${actor.system.habilidades.luta?.base || 2}d6kh${actor.system.habilidades.luta?.base || 2}`;
                const fakeEv = {
                    preventDefault: () => { },
                    currentTarget: { dataset: { label: "ATAQUE EXTRA (BRIGA)", ability: "luta", roll: formula } }
                };
                sheet._onRoll(fakeEv);
            } else {
                const firstId = weapons[0].id;
                sheet.rollWeapon(firstId);
            }
        });

        html.find('.empty-box').click(ev => {
            if (game.user.targets.size === 0) return ui.notifications.warn("Selecione um alvo (T) primeiro!");
            const actor = this.activeToken.actor;
            const sheet = (actor.sheet && actor.sheet instanceof GOTActorSheet) ? actor.sheet : new GOTActorSheet(actor);
            const formula = `${actor.system.habilidades.luta?.base || 2}d6kh${actor.system.habilidades.luta?.base || 2}`;
            const fakeEv = {
                preventDefault: () => { },
                currentTarget: { dataset: { label: "BRIGA", ability: "luta", roll: formula } }
            };
            sheet._onRoll(fakeEv);
        });

        html.find('.btn-end-turn').click(ev => {
            if (!game.combat) return ui.notifications.warn("Nao ha combate ativo!");
            const currentActorId = game.combat.combatant?.actorId;
            if (currentActorId !== this.activeToken.actor.id) return ui.notifications.warn("Nao e o seu turno!");
            game.combat.nextTurn();
        });

        html.find('.btn-toggle').click(async ev => {
            const prop = ev.currentTarget.dataset.prop;
            const actor = this.activeToken.actor;
            const current = foundry.utils.getProperty(actor, prop);

            if (prop === "system.combate_intriga.esforco_ativo") {
                await actor.update({ [prop]: !current });
                if (!current) {
                    const effort = actor.system.combate_intriga.esforco.value;
                    if (effort > 0) await actor.update({ "system.combate_intriga.esforco.value": effort - 1 });
                }
            } else {
                await actor.update({ [prop]: !current });
            }
            this.render();
        });

        html.find('.btn-adjust').click(async ev => {
            const prop = ev.currentTarget.dataset.prop;
            const delta = parseInt(ev.currentTarget.dataset.delta);
            const actor = this.activeToken.actor;

            const current = foundry.utils.getProperty(actor, prop) || 0;
            let newValue = current + delta;

            if (prop.includes("lesoes") || prop.includes("ferimentos") || prop.includes("esforco.value")) {
                newValue = Math.max(0, newValue);
            }

            await actor.update({ [prop]: newValue });
            this.render();
        });
    }
}

/**
 * GOTBattleHUD
 * A specialized HUD for Unit Warfare (G key)
 */
class GOTBattleHUD extends Application {
    constructor(options = {}) {
        super(options);
        this.activeToken = null;
        this.enabled = game.settings.get("got-character-sheet", "battleHudEnabled");
        this.activeTab = "ataque";
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "got-battle-hud",
            classes: ["got-hud-app", "got-battle-hud-window"],
            template: "modules/got-character-sheet/templates/battle-hud.hbs",
            popOut: true,
            minimizable: false,
            resizable: false,
            draggable: false,
            width: 1050,
            height: 280
        });
    }

    render(force = false, options = {}) {
        if (!this.enabled && !force) {
            this.close();
            return;
        }
        if (this.activeToken?.actor?.system.tipo_ficha !== "unit") {
            this.close();
            return;
        }
        return super.render(force, options);
    }

    getData() {
        if (!this.activeToken) return {};
        const actor = this.activeToken.actor;
        if (!actor || actor.system.tipo_ficha !== "unit") return {};

        const system = actor.system;
        const m = system.militar || {};

        // Ensure absolute sync with the Unit Sheet by calling its exact preparation logic.
        const sheetContext = { actor, system, points: {}, baseStats: {}, dist: {} };
        const dummySheet = (actor.sheet instanceof GOTActorSheet) ? actor.sheet : new GOTActorSheet(actor);
        if (typeof dummySheet._prepareUnitData === 'function') {
            dummySheet._prepareUnitData(sheetContext);
        }

        // --- Stats ---
        const healthMax = m.saude?.max || 0;
        const healthValue = Number(m.saude?.value ?? healthMax);
        const healthPct = Math.min(100, (healthValue / healthMax) * 100);

        const disciplineMax = m.disciplina_final || 0;
        const disciplineValue = Number(m.moral ?? disciplineMax);

        const moveBase = m.movimento_final || 0;
        const distanceMoved = this.activeToken.document.getFlag("got-character-sheet", "distanciaMovida") || 0;
        const moveRemainingNum = Math.max(0, moveBase - distanceMoved);

        // --- Damage ---
        const powerBase = m.poder_final || 0;
        const normSize = (m.tamanho || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let reqWarfare = 1;
        let sizeMultiplierBase = 1;

        if (normSize.includes("unidade")) { reqWarfare = 2; sizeMultiplierBase = 2; }
        else if (normSize.includes("batalhao")) { reqWarfare = 3; sizeMultiplierBase = 3; }
        else if (normSize.includes("legiao")) { reqWarfare = 4; sizeMultiplierBase = 4; }

        const commanderWarfare = sheetContext.comandante?.warfare || 0;
        const hasCommandPenalty = commanderWarfare < reqWarfare;
        const sizeMultiplier = hasCommandPenalty ? 1 : sizeMultiplierBase;

        const unitDamage = powerBase * sizeMultiplier;

        // --- Target Info ---
        const targetToken = game.user.targets.size > 0 ? Array.from(game.user.targets)[0] : null;
        let targetInfo = null;
        if (targetToken) {
            const tActor = targetToken.actor;
            const tSys = tActor?.system || {};
            const isTargetUnit = tSys.tipo_ficha === "unit";

            let tDef = 0;
            let tArm = 0;

            if (isTargetUnit) {
                const targetSheetContext = { actor: tActor, system: tSys, points: {}, baseStats: {}, dist: {} };
                const tSheet = (tActor.sheet instanceof GOTActorSheet) ? tActor.sheet : new GOTActorSheet(tActor);
                if (typeof tSheet._prepareUnitData === 'function') tSheet._prepareUnitData(targetSheetContext);
                
                tDef = targetSheetContext.unitDefense || 0;
                tArm = tSys.militar?.armadura || 0;
            } else {
                tDef = Number(tSys.combate_intriga?.defesa || 0);
                tArm = Number(tSys.combate_intriga?.armadura || 0);
            }

            const effectiveDamage = Math.max(0, unitDamage - tArm);
            targetInfo = {
                name: targetToken.name,
                img: targetToken.document.texture.src,
                defense: tDef,
                armor: tArm,
                effectiveDamage
            };
        }

        const typeKey = m.tipo || "Infantaria";
        const icons = {
            "Garrison": "fas fa-shield-alt", "Engenheiros": "fas fa-hammer", "Mulas / Vagões": "fas fa-horse-head",
            "Corvos": "fas fa-crow", "Infantaria": "fas fa-male", "Batedores": "fas fa-eye",
            "Arqueiros": "fas fa-bullseye", "Cavalaria": "fas fa-horse", "Navios Furtivos": "fas fa-ship",
            "Navios de Guerra": "fas fa-anchor", "Tropas Especiais": "fas fa-star", "Mercenários": "fas fa-coins",
            "Camponeses": "fas fa-user-friends", "Elefantes": "fas fa-paw"
        };
        const typeIcon = icons[typeKey] || "fas fa-flag";

        return {
            actor, token: this.activeToken, system,
            healthValue, healthMax, healthPct,
            disciplineValue, disciplineMax, disciplinePct: 100,
            isFleeing: (healthValue <= 0),
            powerBase, sizeMultiplier, unitDamage,
            hasCommandPenalty,
            unitDefense: sheetContext.unitDefense || 0,
            unitArmor: m.armadura || 0,
            moveBase, moveRemaining: moveRemainingNum.toFixed(1), movePct: moveBase > 0 ? Math.min(100, (moveRemainingNum / moveBase) * 100) : 0,
            dynamicManeuvers: sheetContext.dynamicManeuvers || [],
            customManeuvers: sheetContext.customManeuvers || [],
            comandante: sheetContext.comandante,
            subcomandante: sheetContext.subcomandante,
            points: sheetContext.points || {},
            target: targetInfo,
            tacticsBonus: m.luta_bonus_from_tactics || 0,
            activeTab: this.activeTab || 'ataque',
            typeIcon
        };
    }

    updateToken(token) {
        this.activeToken = token;
        if (token && token.actor?.system.tipo_ficha === "unit" && this.enabled) this.render(true);
        else this.close();
    }

    async toggle() {
        this.enabled = !this.enabled;
        await game.settings.set("got-character-sheet", "battleHudEnabled", this.enabled);
        if (this.enabled) {
            const token = canvas.tokens.controlled[0];
            if (token && token.actor?.system.tipo_ficha === "unit") this.updateToken(token);
        } else {
            this.close();
        }
        ui.notifications.info(`Battle HUD ${this.enabled ? "Ativado" : "Desativado"}. (Tecla G)`);
    }

    activateListeners(html) {
        super.activateListeners(html);
        const hudElement = html.find('.got-hud');
        if (hudElement.length) new Draggable(this, html, hudElement[0], false);

        html.find('.hud-tab-btn').click(ev => {
            this.activeTab = ev.currentTarget.dataset.tab;
            this.render();
        });

        html.find('.hud-unit-roll').click(ev => {
            const actor = this.activeToken.actor;
            const sheet = (actor.sheet instanceof GOTActorSheet) ? actor.sheet : new GOTActorSheet(actor);
            sheet._onUnitRoll(ev);
        });

        html.find('.btn-adjust').click(async ev => {
            const prop = ev.currentTarget.dataset.prop;
            const delta = parseInt(ev.currentTarget.dataset.delta);
            const current = foundry.utils.getProperty(this.activeToken.actor, prop) || 0;
            await this.activeToken.actor.update({ [prop]: current + delta });
        });

        html.find('.hud-maneuver').click(async ev => {
            const data = ev.currentTarget.dataset;
            const actor = this.activeToken.actor;
            if (!actor) return;
            
            const actionId = (data.id || "").toLowerCase().trim();
            const actionName = (data.name || "").toLowerCase().trim();

            // 1. ESPECIAL: CARGA MONTADA (Toggle)
            if (actionId.includes("carga") || actionName.includes("carga")) {
                const current = actor.getFlag("got-character-sheet", "charging") || false;
                await actor.setFlag("got-character-sheet", "charging", !current);
                if (!current) {
                    ui.notifications.info(`${actor.name} está preparando uma Carga Montada (+2 Dano no próximo ataque)!`);
                }
                this.render();
                return;
            }

            // 2. ESPECIAL: PISOTEAR (Rolo de Ataque)
            if (actionId.includes("pisotear") || actionName.includes("pisotear")) {
                const ability = actor.system.habilidades?.lidar_com_animais?.base || 2;
                let specBonus = 0;
                const specs = actor.system.habilidades?.lidar_com_animais?.especialidades || {};
                for (let [k, v] of Object.entries(specs)) {
                    if (k.toLowerCase().includes("montar")) {
                        specBonus = v;
                        break;
                    }
                }
                const roll = new Roll(`${ability + specBonus}d6kh${ability}`);
                await roll.evaluate();
                
                const mount = actor.items?.find(i => i.system?.type === "montaria" && i.system?.uso === true);
                const dmgValue = mount?.system?.ataques?.pisotear?.dano || 2;
                const attrVal = actor.system.habilidades?.atletismo?.base || 2;

                let content = `
                    <div class="got-hud-card weapon-card">
                        <header class="card-header">
                            <img src="${actor.img}" title="${actor.name}"/>
                            <h3>Pisotear (Montaria)</h3>
                        </header>
                        <div class="card-content">
                            <b>Teste de Lidar com Animais (Montar):</b> ${roll.total}<br>
                            <b>Dano:</b> ${dmgValue + attrVal}<br>
                            <small>Alvo fica Caído se atingido.</small>
                        </div>
                    </div>`;

                ChatMessage.create({
                    user: game.user.id,
                    speaker: ChatMessage.getSpeaker({ actor: actor }),
                    content: content,
                    rolls: [roll],
                    type: CONST.CHAT_MESSAGE_TYPES.ROLL
                });
                return;
            }

            // 3. ESPECIAL: ATAQUE MONTADO (Shortcut)
            if (actionId === "atq_montado" || actionId === "ataque montado") {
                const weapons = actor.items.filter(i => i.system.type === "arma");
                if (weapons.length === 1) {
                    const sheet = (actor.sheet instanceof GOTActorSheet) ? actor.sheet : new GOTActorSheet(actor);
                    sheet.rollWeapon(weapons[0].id);
                } else if (weapons.length > 1) {
                    ui.notifications.info("Selecione qual arma usar para o Ataque Montado.");
                } else {
                    ui.notifications.warn("Nenhuma arma equipada para o Ataque Montado.");
                }
                return;
            }

            // 4. PADRÃO: Enviar descrição da manobra
            const descriptions = {
                "ajudar": "Concede +1D em um teste de um aliado ou +2 na Defesa dele ate o inicio do seu proximo turno. (Acao Menor)",
                "interagir": "Realizar tarefas simples como abrir uma porta, pegar um item do chao, sacar uma arma ou montar em um cavalo. (Acao Menor)",
                "levantar": "Levantar-se do chao consome uma acao menor e nao provoca ataques de oportunidade. (Acao Menor)",
                "mover": "Permite mover-se uma distancia de quadrados igual a sua Graduacao em Atletismo. (Acao Menor)",
                "carga": "Move-se e ataca em uma unica acao. Recebe -1D no teste de Luta, mas soma +2 no Dano final. (Acao Maior)",
                "corrida": "Move-se uma distancia de quadrados igual a 4x sua Graduacao em Atletismo. (Acao Maior)",
                "derrubar": "Teste de Atletismo (Forca) ou Luta (Briga) contra a Defesa Passiva do alvo para deixa-lo caido. (Acao Maior)",
                "desarmar": "Teste de Luta contra a Defesa do alvo para tentar remover a arma das maos dele. (Acao Maior)",
                "esquiva": "Realiza um teste de Agilidade (Esquiva). O resultado substitui sua Defesa contra todos os ataques ate o proximo turno. (Acao Maior)",
                "fintar": "Teste de Enganacao (Astucia) contra a Defesa do alvo. Se vencer, ganha +1D no proximo ataque e ignora o bonus de Defesa do alvo. (Acao Maior)",
                "imobilizar": "Teste de Atletismo (Forca) contra Atletismo para agarrar e imobilizar o alvo, impedindo-o de agir livremente. (Acao Maior)",
                "passar": "Fica em guarda aguardando uma oportunidade. Recebe +2B no proximo teste ou acao de ataque. (Acao Maior)",
                "puxar_cavaleiro": "Teste de Atletismo (Forca) contra o Atletismo do cavaleiro para tentar derruba-lo da montaria. (Acao Maior)",
                "recuperar_folego": "Teste de Vigor para recuperar 1 de Ferimento sofrido ou 1 ponto de Esforco gasto nesta cena. (Acao Maior)",
                "atq_dividido": "Permite dividir seus dados de Luta ou Pontaria para atacar multiplos alvos em um unico turno. (Acao Maior)",
                "atq_duas_armas": "Ataque com uma arma em cada mao. Aplica as penalidades de mao inabil conforme as regras de combate. (Acao Maior)"
            };

            const isStance = data.isStance === "true";
            if (isStance) {
                const currentStance = actor.system.militar.posturaAtiva || "";
                const newStance = (currentStance === data.name) ? "" : data.name;
                await actor.update({ "system.militar.posturaAtiva": newStance });
                ui.notifications.info(`${actor.name} assumiu a postura: ${newStance || "Desconectada"}`);
                this.render();
                return;
            }

            const content = `
                <div class="got-hud-card maneuver-card">
                    <header class="card-header">
                        <i class="${ev.currentTarget.querySelector('i')?.className || 'fas fa-dice'}"></i>
                        <h3>${data.name}</h3>
                    </header>
                    <div class="card-content">
                        <p>${descriptions[actionId] || "Descricao da manobra nao encontrada."}</p>
                    </div>
                </div>
            `;

            await ChatMessage.create({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: content,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER
            });
        });

        html.find('.recovery-btn').click(async ev => {
            if (ev.currentTarget.classList.contains('disabled')) return;
            const actor = this.activeToken.actor;
            const discipline = actor.system.militar.moral;

            if (discipline <= 0) return ui.notifications.error("Sem Disciplina para reagrupar!");

            const cmdId = actor.system.militar.comandante;
            let warfare = 2;
            let comando = 0;

            if (cmdId && game.actors.get(cmdId)) {
                const a = game.actors.get(cmdId);
                warfare = Number(a.system?.habilidades?.guerra?.base) || 2;
                const specs = a.system?.habilidades?.guerra?.especialidades || [];
                for (let s of Object.values(specs)) {
                    if (!s) continue;
                    let sName = (typeof s.name === "string") ? s.name : (s.label || "");
                    const normSName = sName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    if (normSName.includes("comando")) {
                        comando = Number(s.value || 0);
                    }
                }
            }

            const cd = 17 - discipline;
            const formula = `${warfare + comando}d6kh${warfare}`;
            const roll = new Roll(formula);
            await roll.evaluate();

            await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `<b>Tática de Reagrupar</b><br>Teste do General (Guerra)<br>Dificuldade (CD): <b>${cd}</b>` });

            if (roll.total >= cd) {
                const healthMax = actor.system.militar.saude?.max || 10;
                await actor.update({ 
                    "system.militar.moral": discipline - 1,
                    "system.militar.saude.value": healthMax 
                });
                ui.notifications.info(`Sucesso (${roll.total} vs ${cd})! Unidade Reagrupada no campo de batalha.`);
            } else {
                await actor.update({ "system.militar.moral": discipline - 1 });
                ui.notifications.warn(`Falhou (${roll.total} vs ${cd})! Tropa não conseguiu reagrupar e recuou mais.`);
            }
        });

        // Manual Movement Reset
        html.find('.btn-reset-move').click(async ev => {
            const token = this.activeToken;
            if (token) {
                await token.document.setFlag("got-character-sheet", "distanciaMovida", 0);
                ui.notifications.info("Movimento da tropa resetado para este turno.");
                this.render();
            }
        });

        html.find('.btn-end-turn').click(ev => {
            if (game.combat) game.combat.nextTurn();
        });
    }
}

// Global initialization
Hooks.once("init", () => {
    game.settings.register("got-character-sheet", "hudEnabled", {
        name: "Habilitar HUD de Combate",
        hint: "Mostra o HUD de combate ao selecionar um Token.",
        scope: "client",
        config: true,
        type: Boolean,
        default: true
    });

    console.log("GOT | Init - Initializing Combat HUD (Merged)");
    game.gotHUD = new GOTCombatHUD();

    game.settings.register("got-character-sheet", "battleHudEnabled", {
        name: "Habilitar HUD de Batalha",
        hint: "Mostra o HUD de guerra ao selecionar uma Unidade.",
        scope: "client",
        config: true,
        type: Boolean,
        default: true
    });
    game.gotBattleHUD = new GOTBattleHUD();

    // Register Keybinding for 'K'
    game.keybindings.register("got-character-sheet", "toggleHUD", {
        name: "Toggle Combat HUD",
        hint: "Alterna a visibilidade do HUD de Combate para o Token selecionado.",
        editable: [{ key: "KeyK" }],
        onDown: () => {
            game.gotHUD.toggle();
            return true;
        }
    });

    // Register Keybinding for 'G'
    game.keybindings.register("got-character-sheet", "toggleBattleHUD", {
        name: "Toggle Battle HUD",
        hint: "Alterna a visibilidade do HUD de Batalha (Guerra) para a Unidade selecionada.",
        editable: [{ key: "KeyG" }],
        onDown: () => {
            game.gotBattleHUD.toggle();
            return true;
        }
    });
});

// Override Foundry initiative to use SIFRP custom formulas
async function gotRollAllInitiative(combat) {
    for (const combatant of combat.combatants) {
        if (combatant.initiative !== null) continue;
        const actor = combatant.actor;
        if (!actor) continue;

        let roll;
        let flavorLabel;

        if (actor.system.tipo_ficha === "unit") {
            const mil = actor.system.militar;
            let warfare = 2;
            let cmdName = "Sem Comandante";
            if (mil?.comandante) {
                const cmd = game.actors.get(mil.comandante);
                if (cmd) {
                    warfare = cmd.system.habilidades?.guerra?.base || 2;
                    cmdName = cmd.name;
                }
            }
            roll = new Roll(`${warfare}d6`);
            flavorLabel = `<b>Iniciativa de Massa (${actor.name})</b><br>Comandante: ${cmdName} | Guerra: ${warfare}`;
        } else {
            const agility = actor.system.habilidades?.agilidade?.base || 2;
            const rapidez = actor.system.habilidades?.agilidade?.especialidades?.rapidez || 0;
            const wounds = Number(actor.system.combate_intriga?.lesoes?.value) || 0;
            const injuries = Number(actor.system.combate_intriga?.ferimentos?.value) || 0;
            const diceCount = Math.max(1, (agility + rapidez) - wounds);
            const keepCount = Math.max(1, agility - wounds);
            let formula = `${diceCount}d6kh${keepCount}`;
            if (injuries > 0) formula += ` - ${injuries}`;
            roll = new Roll(formula);
            let penaltyLabel = "";
            if (rapidez > 0) penaltyLabel += `<br><span style="color:blue">Bonus de Rapidez: +${rapidez}B</span>`;
            if (wounds > 0) penaltyLabel += `<br><span style="color:red">Penalidade (Lesao): -${wounds}D</span>`;
            if (injuries > 0) penaltyLabel += `<br><span style="color:red">Penalidade (Ferimento): -${injuries}</span>`;
            flavorLabel = `<b>Iniciativa de Combate (${actor.name})</b><br>Agilidade: ${agility}${penaltyLabel}`;
        }

        await roll.evaluate();
        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            flavor: flavorLabel
        });
        await combatant.update({ initiative: roll.total });
    }
}

Hooks.on("combatStart", async (combat) => {
    await gotRollAllInitiative(combat);
});


// Sidebar Controls
Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = controls.find(c => c.name === "token");
    if (tokenControls) {
        tokenControls.tools.push({
            name: "got-combat-hud-toggle",
            title: "Toggle Battle HUD (K)",
            icon: "fas fa-shield-alt",
            toggle: true,
            active: game.gotHUD?.enabled,
            onClick: toggle => game.gotHUD.toggle()
        });
    }
});

// Update Hooks
Hooks.on("controlToken", (token, controlled) => {
    if (controlled) {
        game.gotHUD?.updateToken(token);
        game.gotBattleHUD?.updateToken(token);
    } else if (canvas.tokens.controlled.length === 0) {
        game.gotHUD?.updateToken(null);
        game.gotBattleHUD?.updateToken(null);
    }
});


// Consolidated Update Combat Hook
Hooks.on("updateCombat", async (combat, update, options, userId) => {
    if (!("turn" in update || "round" in update)) return;
    const actor = combat.combatant?.actor;
    if (actor) {
        await actor.update({ "system.combate_intriga.sprint_ativo": false });
        const token = actor.getActiveTokens()[0];
        if (token) await token.document.setFlag("got-character-sheet", "distanciaMovida", 0);
    }
    if (game.gotHUD?.enabled) game.gotHUD.render();
    if (game.gotBattleHUD?.enabled) game.gotBattleHUD.render();
});

Hooks.on("deleteCombat", async (combat) => {
    // Reset all flags when combat is deleted
    for (let c of combat.combatants) {
        const actor = c.actor;
        if (actor) {
            await actor.update({ "system.combate_intriga.sprint_ativo": false });
            const token = actor.getActiveTokens()[0];
            if (token) {
                await token.document.setFlag("got-character-sheet", "distanciaMovida", 0);
            }
        }
    }
    if (game.gotHUD?.enabled) game.gotHUD.render();
    if (game.gotBattleHUD?.enabled) game.gotBattleHUD.render();
});

Hooks.on("targetToken", () => {
    if (game.gotHUD?.enabled) game.gotHUD.render();
    if (game.gotBattleHUD?.enabled) game.gotBattleHUD.render();
});

Hooks.on("updateUser", (user, update) => {
    if (update.targets) {
        if (game.gotHUD?.enabled) game.gotHUD.render();
        if (game.gotBattleHUD?.enabled) game.gotBattleHUD.render();
    }
});

// Handle Damage Application from Chat
Hooks.on("renderChatMessage", (app, html, data) => {
    // Shared logic for finding target
    const getTarget = (btn) => {
        const targetId = btn.dataset.targetId;
        if (!targetId) return null;
        return game.actors.get(targetId) || canvas.tokens.get(targetId)?.actor;
    };

    const disableButtons = (btn) => {
        const container = btn.closest('.combat-damage-buttons') || btn.parentElement;
        container.querySelectorAll('button').forEach(b => {
            b.disabled = true;
            b.style.opacity = "0.5";
        });
        btn.innerText = "Dano Aplicado";
        btn.style.opacity = "1";
        btn.style.fontWeight = "bold";
    };

    // 1. UNIT DAMAGE (Simplified)
    html.find(".apply-unit-damage-btn").click(async ev => {
        ev.preventDefault();
        const target = getTarget(ev.currentTarget);
        if (!target) return ui.notifications.error("Alvo não encontrado.");
        const damage = parseInt(ev.currentTarget.dataset.damage);
        const path = "system.militar.saude.value";
        const current = foundry.utils.getProperty(target, path) || 0;
        await target.update({ [path]: Math.max(0, current - damage) });
        ui.notifications.info(`${target.name} sofreu ${damage} de dano.`);
        ev.currentTarget.disabled = true;
        ev.currentTarget.innerText = "Dano Aplicado";
    });

    // 2. CHARACTER: FULL DAMAGE (Subtrair Vida)
    html.find(".apply-damage-btn").click(async ev => {
        ev.preventDefault();
        const target = getTarget(ev.currentTarget);
        if (!target) return ui.notifications.error("Alvo não encontrado.");
        const damage = parseInt(ev.currentTarget.dataset.damage);
        const current = target.system.combate_intriga?.saude?.value || 0;
        await target.update({ "system.combate_intriga.saude.value": Math.max(0, current - damage) });
        ui.notifications.info(`${target.name} sofreu ${damage} de dano.`);
        disableButtons(ev.currentTarget);
    });

    // 3. CHARACTER: INJURY (Ferimento) -> Dano - Resistencia, e +1 Ferimento
    html.find(".apply-injury-btn").click(async ev => {
        ev.preventDefault();
        const target = getTarget(ev.currentTarget);
        if (!target) return ui.notifications.error("Alvo não encontrado.");
        
        const damage = parseInt(ev.currentTarget.dataset.damage);
        const res = target.system.habilidades?.resistencia?.base || 2;
        const currentInjuries = target.system.combate_intriga?.ferimentos?.value || 0;
        const currentHealth = target.system.combate_intriga?.saude?.value || 0;

        const effectiveDmg = Math.max(0, damage - res);
        await target.update({ 
            "system.combate_intriga.saude.value": Math.max(0, currentHealth - effectiveDmg),
            "system.combate_intriga.ferimentos.value": currentInjuries + 1
        });

        ui.notifications.info(`${target.name} recebeu um Ferimento! Reduziu o dano em ${res} e sofreu ${effectiveDmg} na Saúde.`);
        disableButtons(ev.currentTarget);
    });

    // 4. CHARACTER: WOUND (Lesão) -> 0 Dano, e +1 Lesão
    html.find(".apply-wound-btn").click(async ev => {
        ev.preventDefault();
        const target = getTarget(ev.currentTarget);
        if (!target) return ui.notifications.error("Alvo não encontrado.");

        const currentWounds = target.system.combate_intriga?.lesoes?.value || 0;
        await target.update({ "system.combate_intriga.lesoes.value": currentWounds + 1 });

        ui.notifications.warn(`${target.name} recebeu uma Lesão! Todo o dano de saúde foi ignorado.`);
        disableButtons(ev.currentTarget);
    });

    // 5. MOUNT DAMAGE (Dano à Montaria)
    html.find(".apply-mount-damage-btn").click(async ev => {
        ev.preventDefault();
        const target = getTarget(ev.currentTarget);
        if (!target) return ui.notifications.error("Alvo não encontrado.");

        const mount = target.items?.find(i => i.system?.type === "montaria" && i.system?.uso === true);
        if (!mount) return ui.notifications.warn(`${target.name} não tem uma montaria ativa!`);

        const damage = parseInt(ev.currentTarget.dataset.damage);
        const currentHP = mount.system?.saude?.value || 0;
        const newHP = Math.max(0, currentHP - damage);

        await mount.update({ "system.saude.value": newHP });
        ui.notifications.info(`A montaria ${mount.name} de ${target.name} sofreu ${damage} de dano! (Saúde: ${newHP}/${mount.system?.saude?.max || 0})`);

        if (newHP <= 0) {
            ui.notifications.warn(`A montaria ${mount.name} de ${target.name} foi abatida!`);
        }
        disableButtons(ev.currentTarget);
    });
});

// Global initialization
Hooks.once("init", () => {
    game.settings.register("got-character-sheet", "hudEnabled", {
        name: "Habilitar HUD de Combate",
        hint: "Mostra o HUD de combate ao selecionar um Token.",
        scope: "client",
        config: true,
        type: Boolean,
        default: true
    });

    console.log("GOT | Init - Initializing HUDs");
    game.gotHUD = new GOTCombatHUD();
    game.gotBattleHUD = new GOTBattleHUD();

    game.settings.register("got-character-sheet", "battleHudEnabled", {
        name: "Habilitar HUD de Batalha",
        hint: "Mostra o HUD de guerra ao selecionar uma Unidade.",
        scope: "client",
        config: true,
        type: Boolean,
        default: true
    });

    // Register Keybinding for 'K'
    game.keybindings.register("got-character-sheet", "toggleHUD", {
        name: "Toggle Combat HUD",
        hint: "Alterna a visibilidade do HUD de Combate.",
        editable: [{ key: "KeyK" }],
        onDown: () => {
            game.gotHUD.toggle();
            return true;
        }
    });

    // Register Keybinding for 'G'
    game.keybindings.register("got-character-sheet", "toggleBattleHUD", {
        name: "Toggle Battle HUD",
        hint: "Alterna a visibilidade do HUD de Batalha.",
        editable: [{ key: "KeyG" }],
        onDown: () => {
            game.gotBattleHUD.toggle();
            return true;
        }
    });
});


Hooks.once("ready", () => {
    console.log("GOT | Ready - Token Detection");
    const controlled = canvas.tokens?.controlled || [];
    if (controlled.length > 0) {
        game.gotHUD.updateToken(controlled[0]);
        game.gotBattleHUD.updateToken(controlled[0]);
    }
});

Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = controls.find(c => c.name === "token");
    if (tokenControls) {
        tokenControls.tools.push({
            name: "got-combat-hud-toggle",
            title: "Battle HUD (K/G)",
            icon: "fas fa-shield-alt",
            toggle: true,
            active: game.gotHUD?.enabled,
            onClick: toggle => game.gotBattleHUD.toggle()
        });
    }
});

Hooks.on("controlToken", (token, controlled) => {
    if (controlled) {
        game.gotHUD?.updateToken(token);
        game.gotBattleHUD?.updateToken(token);
    } else if (canvas.tokens.controlled.length === 0) {
        game.gotHUD?.updateToken(null);
        game.gotBattleHUD?.updateToken(null);
    }
});

// Consolidated Update Combat Hook
Hooks.on("updateCombat", async (combat, update, options, userId) => {
    if (!("turn" in update || "round" in update)) return;
    const actor = combat.combatant?.actor;
    if (actor) {
        await actor.update({ "system.combate_intriga.sprint_ativo": false });
        const token = actor.getActiveTokens()[0];
        if (token) await token.document.setFlag("got-character-sheet", "distanciaMovida", 0);
    }
    if (game.gotHUD?.enabled) game.gotHUD.render();
    if (game.gotBattleHUD?.enabled) game.gotBattleHUD.render();
});

Hooks.on("preUpdateToken", (tokenDoc, update, options, userId) => {
    if (!game.combat) return;
    if (!("x" in update || "y" in update)) return;
    const actor = tokenDoc.actor;
    if (!actor) return;
    const p0 = { x: tokenDoc.x, y: tokenDoc.y };
    const p1 = { x: "x" in update ? update.x : p0.x, y: "y" in update ? update.y : p0.y };
    if (p0.x === undefined || p1.x === undefined) return;
    const path = canvas.grid.measurePath([p0, p1]);
    const gridDist = canvas.scene.grid.distance || 1.5;
    const squaresMoved = path.distance / gridDist;
    if (squaresMoved > 0) {
        const currentDist = tokenDoc.getFlag("got-character-sheet", "distanciaMovida") || 0;
        const newDist = currentDist + squaresMoved;
        if (!update.flags) update.flags = {};
        if (!update.flags["got-character-sheet"]) update.flags["got-character-sheet"] = {};
        update.flags["got-character-sheet"].distanciaMovida = newDist;
    }
});

Hooks.on("updateToken", (tokenDoc, update, options, userId) => {
    if (!game.combat) return;
    const isMovement = ("x" in update || "y" in update);
    if (!isMovement && !(update.flags?.["got-character-sheet"]?.distanciaMovida !== undefined)) return;
    if (game.gotHUD?.enabled && game.gotHUD.activeToken?.id === tokenDoc.id) game.gotHUD.render();
    if (game.gotBattleHUD?.enabled && game.gotBattleHUD.activeToken?.id === tokenDoc.id) game.gotBattleHUD.render();
});

Hooks.on("updateActor", (actor, update, options, userId) => {
    if (game.gotHUD?.enabled && game.gotHUD.activeToken?.actor.id === actor.id) game.gotHUD.render();
    if (game.gotBattleHUD?.enabled && game.gotBattleHUD.activeToken?.actor.id === actor.id) game.gotBattleHUD.render();
});

Hooks.on("deleteCombat", async (combat) => {
    for (let c of combat.combatants) {
        const actor = c.actor;
        if (actor) {
            await actor.update({ "system.combate_intriga.sprint_ativo": false });
            const token = actor.getActiveTokens()[0];
            if (token) await token.document.setFlag("got-character-sheet", "distanciaMovida", 0);
        }
    }
    if (game.gotHUD?.enabled) game.gotHUD.render();
    if (game.gotBattleHUD?.enabled) game.gotBattleHUD.render();
});

Hooks.on("targetToken", () => {
    if (game.gotHUD?.enabled) game.gotHUD.render();
    if (game.gotBattleHUD?.enabled) game.gotBattleHUD.render();
});

Hooks.on("updateUser", (user, update) => {
    if (update.targets) {
        if (game.gotHUD?.enabled) game.gotHUD.render();
        if (game.gotBattleHUD?.enabled) game.gotBattleHUD.render();
    }
});
