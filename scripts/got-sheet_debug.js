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
            return {
                id: actor.id,
                name: actor.name,
                img: actor.img,
                warfare: h.base || 2,
                comando: h.especialidades?.comando || 0,
                estrategia: h.especialidades?.["estratégia"] || h.especialidades?.estrategia || 0,
                tatica: h.especialidades?.["tática"] || h.especialidades?.tatica || 0
            };
        };

        context.comandante = resolveLeader(m.comandante);
        context.subcomandante = resolveLeader(m.subcomandante);

        // 1. Max Size Logic (Based on Commander's Warfare)
        // 2=10, 3=100, 4=500, 5=1000
        const warfare = context.comandante?.warfare || 2;
        const sizeMap = { 2: "Pelotão (10)", 3: "Unidade (100)", 4: "Batalhão (500)", 5: "Legião (1000)" };
        const allowedSizes = [
            { val: "Pelotão (10)", limit: 2 },
            { val: "Unidade (100)", limit: 3 },
            { val: "Batalhão (500)", limit: 4 },
            { val: "Legião (1000)", limit: 5 }
        ];

        context.sizeLimit = sizeMap[warfare] || (warfare > 5 ? "Legião (1000)" : "Pelotão (10)");

        // Validation: Is current size allowed?
        const currentSizeObj = allowedSizes.find(s => s.val === m.tamanho);
        const currentLimitReq = currentSizeObj?.limit || 2;
        context.sizeWarning = warfare < currentLimitReq;
        if (context.sizeWarning) {
            context.sizeMsg = `Comandante (Guerra ${warfare}) não tem rank suficiente para ${m.tamanho}. Requer Guerra ${currentLimitReq}.`;
        }

        // 2. Armor Calculation (Training x 3) + Manual Bonus
        const trainingLevels = { "Recruta": 1, "Treinado": 2, "Veterano": 3, "Elite": 4 };
        const trainingVal = trainingLevels[m.treinamento] || 1;
        const armaduraBase = trainingVal * 3;
        m.bonus_armadura = m.bonus_armadura || 0;
        m.armadura = armaduraBase + m.bonus_armadura;
        context.armaduraBase = armaduraBase;

        // 3. Point Distribution System
        // Base Stats
        const baseStats = CONFIG.GOT.unitBaseStats[m.tipo] || CONFIG.GOT.unitBaseStats["Infantaria"];

        // Budgets (Specialty x 5) - Sum of Commander + Sub-commander
        const getSpecSum = (key) => {
            const cmdVal = context.comandante?.[key] || 0;
            const subVal = context.subcomandante?.[key] || 0;
            return cmdVal + subVal;
        };

        const cmdBudget = getSpecSum("comando");
        const strBudget = getSpecSum("estrategia");
        const tacBudget = getSpecSum("tatica");

        // Initialize points if missing
        if (!m.pontos) m.pontos = {};

        // Helper to calc total and validate
        const calcStat = (statKey, category) => {
            const added = m.pontos[statKey] || 0;
            const base = baseStats[statKey] || 0;
            // We return formatting info
            return { base, added, total: base + added, category };
        };

        // Command Category: Luta, Disciplina, Atletismo
        const statsCmd = {
            luta: calcStat("luta", "comando"),
            disciplina: calcStat("disciplina", "comando"),
            atletismo: calcStat("atletismo", "comando")
        };
        // Strategy Category: Movimento, Pontaria, Percepção
        const statsStr = {
            movimento: calcStat("movimento", "estrategia"),
            pontaria: calcStat("pontaria", "estrategia"),
            percepcao: calcStat("percepcao", "estrategia")
        };
        // Tactics Category: Agilidade, Poder, Luta (Shared? User listed Luta twice. I will handle 'Luta' in Command primarily, or split?
        // User request: "a especialidade tática pode distribuir: Agilidade, poder, Luta" AND "comando pode distribuir Luta".
        // This creates a conflict. I will allow Luta to be boosted by COMMAND only for now to avoid double-dipping complexity in UI.
        // OR I allow 'luta_tac' vs 'luta_cmd'. Let's stick to unique assignments. 
        // I will move Luta to TACTICS as it fits 'Combat Prowess'. 
        // Wait, User said "Comando: Luta, Disciplina, Atletismo". "Tática: Agilidade, Poder, Luta".
        // Okay, I will make Luta receive points from BOTH pools if I can.
        // Actually, simplest is: Luta (Cmd) and Luta (Tac). They stack.
        // "pontos.luta_cmd" and "pontos.luta_tac".

        const statsTac = {
            agilidade: calcStat("agilidade", "tatica"),
            poder: calcStat("poder", "tatica"),
            luta_tac: { base: 0, added: m.pontos.luta_tac || 0, total: m.pontos.luta_tac || 0, category: "tatica" } // Additive to base Luta
        };

        // Summing up usage
        const usedCmd = (m.pontos.luta || 0) + (m.pontos.disciplina || 0) + (m.pontos.atletismo || 0);
        const usedStr = (m.pontos.movimento || 0) + (m.pontos.pontaria || 0) + (m.pontos.percepcao || 0);
        const usedTac = (m.pontos.agilidade || 0) + (m.pontos.poder || 0) + (m.pontos.luta_tac || 0);

        context.points = {
            cmd: { total: cmdBudget, used: usedCmd, avail: cmdBudget - usedCmd },
            str: { total: strBudget, used: usedStr, avail: strBudget - usedStr },
            tac: { total: tacBudget, used: usedTac, avail: tacBudget - usedTac }
        };

        // Apply Totals to System Data for Rolls
        // Apply Totals to System Data for Rolls
        m.luta = baseStats.luta + (m.pontos.luta || 0); // Luta (Cmd) adds to Rank
        m.luta_bonus_from_tactics = (m.pontos.luta_tac || 0) * 2; // Luta (Tac) adds +2B per point
        m.disciplina = Math.max(1, baseStats.disciplina + (m.pontos.disciplina || 0));
        m.atletismo = baseStats.atletismo + (m.pontos.atletismo || 0);
        m.movimento = baseStats.movimento + (m.pontos.movimento || 0);
        m.pontaria = baseStats.pontaria + (m.pontos.pontaria || 0);
        m.percepcao = baseStats.percepcao + (m.pontos.percepcao || 0);
        m.agilidade = baseStats.agilidade + (m.pontos.agilidade || 0);
        m.poder = baseStats.poder + (m.pontos.poder || 0);

        // Prep UI Objects
        context.dist = {
            comando: {
                luta: { label: "Luta", key: "luta", ...statsCmd.luta },
                disciplina: { label: "Disciplina", key: "disciplina", ...statsCmd.disciplina },
                atletismo: { label: "Atletismo", key: "atletismo", ...statsCmd.atletismo }
            },
            estrategia: {
                movimento: { label: "Movimento", key: "movimento", ...statsStr.movimento },
                pontaria: { label: "Pontaria", key: "pontaria", ...statsStr.pontaria },
                percepcao: { label: "Percepção", key: "percepcao", ...statsStr.percepcao }
            },
            tatica: {
                agilidade: { label: "Agilidade", key: "agilidade", ...statsTac.agilidade },
                poder: { label: "Poder", key: "poder", ...statsTac.poder },
                luta_tac: { label: "Luta (Bônus)", key: "luta_tac", ...statsTac.luta_tac }
            }
        };

        // 4. Health Calculation
        // Formula: (Discipline * 3) + Size Weight
        // Note: Discipline is now dynamic from points!
        const sizeHealthMap = { "Pelotão (10)": 0, "Unidade (100)": 10, "Batalhão (500)": 25, "Legião (1000)": 50 };
        const sizeBonus = sizeHealthMap[m.tamanho] || 0;
        m.saude.max = (m.disciplina * 3) + sizeBonus;
        if (m.saude.value === 0 && !m.saude.initialized) {
            m.saude.value = m.saude.max;
            m.saude.initialized = true;
        }

        // Initialize Current Discipline (stored as moral for DB compatibility) if missing
        if (m.moral === undefined) m.moral = m.disciplina || 2;

        // 5. Derived Unit Defense
        // Formula: Agility + Athletics + Perception + Manual Bonus
        const defBase = m.agilidade + m.atletismo + m.percepcao;
        m.bonus_defesa = m.bonus_defesa || 0;
        context.unitDefenseBase = defBase;
        context.unitDefense = defBase + m.bonus_defesa;

        // --- MANEUVERS (Kept mostly same, but updated for dynamic stats if needed) ---
        const maneuversMap = {
            "Infantaria": [
                { name: "Manter a Linha", specialty: "Tática", req: 1, bonus: "+2 Defesa", desc: "A unidade se fecha para segurar o avanço inimigo." },
                { name: "Parede de Escudos", specialty: "Comando", req: 2, bonus: "-2 Dano recebido", desc: "Reduz o dano em troca de metade do movimento." },
                { name: "Avançar", specialty: "Estratégia", req: 1, bonus: "+1D Luta", desc: "Move e ataca com bônus agressivo." }
            ],
            "Arqueiros": [
                { name: "Chuva de Flechas", specialty: "Tática", req: 2, bonus: "Ataque em Área", desc: "Cobre uma área maior com Poder -2." },
                { name: "Atirar e Recuar", specialty: "Estratégia", req: 1, bonus: "Ataca e Move", desc: "Dispara e recua para evitar o corpo-a-corpo." },
                { name: "Fogo de Supressão", specialty: "Comando", req: 1, bonus: "-1D Disc. Alvo", desc: "Assusta o alvo, prejudicando sua disciplina." }
            ],
            "Cavalaria": [
                { name: "Carga Devastadora", specialty: "Comando", req: 3, bonus: "+Poder no Dano", desc: "Dano massivo se mover em linha reta." },
                { name: "Flanquear", specialty: "Tática", req: 2, bonus: "+1D Luta", desc: "Bônus se atacar pelo lado ou retaguarda." },
                { name: "Arraial de Cavalos", specialty: "Estratégia", req: 1, bonus: "Recupera Vigor", desc: "Melhora o moral da unidade ao descansar." }
            ],
            "Piqueiros": [
                { name: "Contra-Carga", specialty: "Tática", req: 2, bonus: "Dano x2", desc: "Dano extra automático contra quem carregar." },
                { name: "Muralha de Piques", specialty: "Comando", req: 1, bonus: "Obstrução", desc: "Impede o movimento de cavalaria próxima." },
                { name: "Falange", specialty: "Estratégia", req: 2, bonus: "+3 Defesa", desc: "Aumenta a Defesa em formações cerradas." }
            ],
            "Espadachim": [
                { name: "Investida Veloz", specialty: "Tática", req: 1, bonus: "Ignora Terreno", desc: "Não sofre penalidades de terreno difícil." },
                { name: "Duelo de Unidade", specialty: "Comando", req: 2, bonus: "+2D vs Comandante", desc: "Foca em eliminar a liderança inimiga." },
                { name: "Cortar Fileiras", specialty: "Estratégia", req: 2, bonus: "2 Alvos", desc: "Ataca dois alvos adjacentes com Luta." }
            ],
            "Armas de Cerco": [
                { name: "Bombardear", specialty: "Estratégia", req: 2, bonus: "Dano x3 vs Estrut.", desc: "Dano alto focado em Edificações e Feudos." },
                { name: "Fogo de Cobertura", specialty: "Tática", req: 1, bonus: "+2 Defesa Aliada", desc: "Protege aliados com disparos constantes." },
                { name: "Destruir Defesas", specialty: "Comando", req: 2, bonus: "-2 Armadura Alvo", desc: "Reduz permanentemente a Armadura do alvo." }
            ],
            "Naval": [
                { name: "Abordagem", specialty: "Comando", req: 2, bonus: "Luta no Convés", desc: "Transforma o combate em infantaria naval." },
                { name: "Ramming (Ramagem)", specialty: "Tática", req: 1, bonus: "Dano Impacto", desc: "Dano massivo de impacto frontal contra botes." },
                { name: "Rajada de Setas", specialty: "Estratégia", req: 2, bonus: "+2D Pontaria", desc: "Usa Pontaria de longo alcance dos conveses." }
            ],
            "Elefante": [
                { name: "Esmagar", specialty: "Tática", req: 2, bonus: "+1D Luta, Dano x2", desc: "Dano massivo contra infantaria ao esmagar suas fileiras." },
                { name: "Terror do Campo", specialty: "Comando", req: 3, bonus: "-1D Disc. Alvos", desc: "O tamanho da fera apavora inimigos próximos." },
                { name: "Torre de Guerra", specialty: "Estratégia", req: 2, bonus: "+1B Comando/Pont.", desc: "A altura permite melhor visão e coordenação." }
            ],
            "Camponês": [
                { name: "Números", specialty: "Comando", req: 1, bonus: "+1D Luta", desc: "Bônus se a unidade for maior que o alvo." },
                { name: "Banda de Guerra", specialty: "Tática", req: 1, bonus: "+2 Defesa", desc: "Bônus se estiver adjacente a outra unidade aliada." },
                { name: "Recuar", specialty: "Estratégia", req: 1, bonus: "Fuga Segura", desc: "Pode se retirar sem sofrer ataques de oportunidade." }
            ]
        };

        // Sum specialties for maneuver requirements (Commander + Sub-commander)
        const getCombined = (key) => {
            return (context.comandante ? (context.comandante[key] || 0) : 0) +
                (context.subcomandante ? (context.subcomandante[key] || 0) : 0);
        };

        // Process Official Maneuvers
        context.dynamicManeuvers = (maneuversMap[m.tipo] || maneuversMap["Infantaria"]).map(man => {
            const specialtyKey = man.specialty.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const combinedValue = getCombined(specialtyKey);
            return {
                ...man,
                met: combinedValue >= (man.req || 0),
                combinedValue
            };
        });

        // Process Custom Maneuvers
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

        // Resolve Leaders
        const resolveLeader = (id, type) => {
            if (!id) return null;
            const actor = game.actors.get(id);
            if (!actor) return null;
            const hStatus = actor.system.habilidades?.status || { base: 2, especialidades: {} };
            const hWar = actor.system.habilidades?.guerra || { base: 2, especialidades: {} };
            const specsStatus = hStatus.especialidades || {};
            const specsWar = hWar.especialidades || {};

            // Utility to find specialty by name (case-insensitive and normalized)
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

        // Process built structures
        if (!d.estruturas) d.estruturas = [];
        const typeCounts = {};
        context.builtStructures = d.estruturas.map((s, idx) => {
            const config = foundry.utils.deepClone(CONFIG.GOT.structures[s.id]);
            if (!config) return null;

            // Manage display name for multiple instances
            typeCounts[s.id] = (typeCounts[s.id] || 0) + 1;
            const instancesOfType = d.estruturas.filter(e => e.id === s.id).length;
            const displayName = instancesOfType > 1 ? `${config.name} ${typeCounts[s.id]}` : config.name;

            const level = s.level || 1;

            const levelBonus = {};
            if (config.bonus) {
                for (let [k, v] of Object.entries(config.bonus)) {
                    // Linear scaling: Level 1 = 1x, Level 2 = 2x, etc.
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

        // Determine Castle Level for dependency logic
        const castle = context.builtStructures.find(s => s.id === "castelo_principal");
        context.castleLevel = castle?.level || 0;

        // Sum all bonuses
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

        // Advanced Notes Penalties (Simple Keyword System)
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

        // Apply penalties to totals
        context.totalOrdem += context.penalties.ordem;
        context.infraBonus.comida += context.penalties.comida;
        context.infraBonus.fortuna += context.penalties.fortuna;

        // Final Maintenance & Yield Calculation (Post-Penalties)
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

        // Generate Tooltips for Hover Details
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

        // Specialized tooltips with maintenance details
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
        // Use direct system data
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
        const specModifiers = {}; // [abilityKey][specName]
        const items = { qualidades: [], defeitos: [], equipamento: [], armas: [], armaduras: [], escudos: [] };
        let totalAR = 0;
        let totalAP = 0;
        let totalBulk = 0;
        let totalShieldBonus = 0;

        for (let i of this.actor.items) {
            const item = i.toObject(false);
            item.id = i.id;

            if (item.system.type === 'qualidade' || item.system.type === 'defeito') {
                let mods = item.system.modificadores;
                if (!mods || typeof mods !== 'object') mods = [];
                else mods = Array.isArray(mods) ? [...mods] : Object.values(mods);
                // Fallback for single-field modifiers
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
                // Dynamic Tooltip calculation
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

                // Detect Specialty Bonus
                const specialtyName = (item.system.especialidade || "").trim();
                let specBonus = 0;
                if (specialtyName) {
                    const normSpec = specialtyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    specBonus = system.habilidades?.[atkKey]?.especialidades?.[normSpec] || 0;
                }

                let attrKey = item.system.atributo_dano;
                if (!attrKey) {
                    // Auto-detect attribute based on SIFRP rules
                    if (esp.includes("curtas") || name.includes("adaga") || name.includes("faca") || name.includes("punhal") || name.includes("espada curta")) attrKey = "agilidade";
                    else if (esp.includes("bestas") || name.includes("besta")) attrKey = "agilidade"; // Crossbows use Agility for damage
                    else if (esp.includes("arcos") || name.includes("arco")) attrKey = "agilidade"; // Bows use Agility for damage (SIFRP Rule)
                    else attrKey = "atletismo"; // Default for most melee
                }
                const attrLabel = attrKey === "nenhum" ? "Nenhum" : (CONFIG.GOT.habilidades[attrKey] || attrKey);
                const totalBonus = (item.system.bonus_dice || 0) + specBonus;
                i.displayTooltip = `(${atkLabel}${totalBonus ? ' +' + totalBonus + 'B' : ''})d6kh[${atkLabel}] | Dano: Base + ${attrLabel}`;

                // SIFRP Rule: Weapon Bulk and Defensive Multi-Scanner (Character/Feud Only)
                const layout = this.actor.system.tipo_ficha || "character";
                if (layout !== "unit") {
                    const props = (item.system.propriedades || "").toLowerCase();
                    const desc = (item.system.description || "").toLowerCase();
                    const fullText = `${name} ${props} ${desc}`;

                    // Add to Bulk if specified
                    if (item.system.bulk) totalBulk += Number(item.system.bulk || 0);

                    // Check for Defensive quality or generic Defesa bonus
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
            else {
                items.equipamento.push(i);
            }
        }

        // Movement Calculation (SIFRP Rule: Base 4 - Bulk)
        context.totalMove = Math.max(1, 4 - totalBulk);
        context.sprintValue = context.totalMove * 4;

        // Grid Conversion (1 yard = 0.91m | grid = 1.5m)
        context.moveSquares = Math.floor((context.totalMove * 0.91) / 1.5);
        context.sprintSquares = Math.floor((context.sprintValue * 0.91) / 1.5);

        // Initialize Gold/Wealth if missing
        if (!context.system.info.ouro && context.system.info.ouro !== 0) {
            context.system.info.ouro = 0;
        }

        // Calculate Penalties (Physical vs Social)
        // Lesões/Frustração = Penalty Dice (Pool)
        // Ferimentos = Result Reduction (Total)
        const wounds = (Number(system.combate_intriga?.lesoes?.value) || 0);
        const injuries = (Number(system.combate_intriga?.ferimentos?.value) || 0);
        const stress = (Number(system.combate_intriga?.estresse?.value) || 0); // mental life - no penalty
        const frustration = (Number(system.combate_intriga?.frustracao?.value) || 0); // mental penalty (-1D)

        const list = [];
        const socialAbilities = ["astucia", "enganacao", "persuasao", "status", "vontade", "conhecimento", "idioma"];

        for (let [key, data] of Object.entries(context.system.habilidades)) {
            if (key === 'idioma' || !CONFIG.GOT.habilidades[key]) continue;
            const bonus = modifiers[key] || 0;
            const base = Number(data.base ?? 2);

            // Penalty Detection
            const isSocial = socialAbilities.includes(key);
            let poolPenalty = isSocial ? frustration : wounds;
            const resultPenalty = isSocial ? 0 : injuries; // Social has no result reduction per user request

            // LOGIC: If Effort (Concentrar) is active, bypass pool penalty for physical tests
            if (!isSocial && context.system.combate_intriga.esforco_ativo) {
                poolPenalty = 0;
            }

            // Generate the roll formula: (Rank + Bonus - PoolPenalty)d6khRank - ResultPenalty
            let finalDiceCount = Math.max(1, base + bonus - poolPenalty);
            let rollFormula = `${finalDiceCount}d6kh${base}`;
            if (resultPenalty > 0) rollFormula += ` - ${resultPenalty}`;

            // Apply Armor Penalty (AP) to Agility tests
            if (key === 'agilidade' && totalAP !== 0) {
                rollFormula += ` ${totalAP > 0 ? '+' : ''}${totalAP}`;
            }

            // Process specialties
            const specialties = [];
            for (let [sKey, sVal] of Object.entries(data.especialidades || {})) {
                const specNameNormal = sKey.toLowerCase().trim();
                const specBonus = (specModifiers[key]?.[specNameNormal] || 0);
                const totalBonusDice = bonus + specBonus;
                const valNum = Number(sVal || 0);
                const totalDice = base + valNum + totalBonusDice;

                // Specialty Penalty: Also subtracts from total dice pool
                let specDiceCount = Math.max(1, totalDice - poolPenalty);

                // Example: Luta 4 + Specialty 1 = 5d6kh4 -> minus 1 penalty = 4d6kh4
                let specRollFormula = specDiceCount > base ? `${specDiceCount}d6kh${base}` : `${specDiceCount}d6`;
                if (resultPenalty > 0) specRollFormula += ` - ${resultPenalty}`;

                // Apply Armor Penalty (AP) to Agility specialties
                if (key === 'agilidade' && totalAP !== 0) {
                    specRollFormula += ` ${totalAP > 0 ? '+' : ''}${totalAP}`;
                }

                if (key === 'luta' || key === 'cura') {
                    console.log(`GOT | Spec Roll Calc [${key}.${sKey}]: base=${base}, spec=${valNum}, bonus=${totalBonusDice}, poolPenalty=${poolPenalty}, resultPenalty=${resultPenalty} => ${specRollFormula}`);
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

        // Derived Values
        const res = context.system.habilidades.resistencia?.base || 2;
        const agi = context.system.habilidades.agilidade?.base || 2;
        const atl = context.system.habilidades.atletismo?.base || 2;
        const per = context.system.habilidades.percepcao?.base || 2;
        const ast = context.system.habilidades.astucia?.base || 2; // Cunning
        const sta = context.system.habilidades.status?.base || 2;   // Status
        const von = context.system.habilidades.vontade?.base || 2; // Will

        // Combat Health & Defense
        context.system.combate_intriga.saude.max = res * 3;
        if (context.system.combate_intriga.saude.value === 0 && !context.system.combate_intriga.saude.initialized) {
            context.system.combate_intriga.saude.value = context.system.combate_intriga.saude.max;
            context.system.combate_intriga.saude.initialized = true;
        }
        context.healthPct = Math.min(100, Math.max(0, (context.system.combate_intriga.saude.value / context.system.combate_intriga.saude.max) * 100));
        context.system.combate_intriga.defesa = agi + atl + per + totalShieldBonus + totalAP; // Combat Defense

        // Intrigue Health (Estresse as Life) & Defense
        context.system.combate_intriga.estresse.max = von * 3;
        context.system.combate_intriga.frustracao.max = 5; // Penalty max
        context.system.combate_intriga.defesa_intriga = per + ast + sta; // Intrigue Defense

        // Daily Effort (Esforço Diário)
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

        // Character Dragging Support (Profile Image)
        const img = html.find('.profile-img');
        img.attr('draggable', true);
        img[0].addEventListener('dragstart', ev => {
            const dragData = {
                type: "Actor",
                uuid: this.actor.uuid
            };
            ev.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        });

        // MANUAL SAVE FALLBACK: Force update on blur for ability/specialty inputs
        // This ensures saving even if Foundry's automatic submitOnChange fails for nested fields
        html.on('blur', 'input[name*="habilidades"]', ev => {
            const name = ev.target.name;
            const val = ev.target.type === 'number' ? Number(ev.target.value || 0) : ev.target.value;
            console.log(`GOT | Manual Save Triggered for ${name}:`, val);
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
            else console.warn("GOT | Item not found for ID:", itemId);
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

        // Toggle Armor/Shield usage
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

        // Unit Rolls
        html.find('.unit-rollable').click(this._onUnitRoll.bind(this));
        html.find('.unit-initiative').click(this._onUnitInitiative.bind(this));

        // Universal Switcher
        html.find('.sheet-type-select').change(ev => {
            this.actor.update({ "system.tipo_ficha": ev.target.value });
        });

        html.find('.advance-month-btn').click(this._onAdvanceMonth.bind(this));

        // Create Custom Maneuver
        html.find('.add-custom-btn').click(this._onAddCustomManeuver.bind(this));
        html.find('.delete-custom-maneuver').click(this._onDeleteCustomManeuver.bind(this));
        html.find('.add-note-btn').click(this._onAddNote.bind(this));
        // Feud Build system
        html.find('.build-structure-btn').click(this._onBuildStructure.bind(this));
        html.find('.upgrade-structure').click(this._onUpgradeStructure.bind(this));
        html.find('.demolish-structure').click(this._onDemolishStructure.bind(this));
        html.find('.add-condition-btn').click(this._onAddCondition.bind(this));
        // Point Distribution System
        html.find('.point-adjust').click(this._onPointAdjust.bind(this));
        // Unit Prop Adjust (Armor/Defense)
        html.find('.unit-prop-adjust').click(this._onUnitPropAdjust.bind(this));

        // Family Tree Standalone
        html.find('.open-family-tree').on('click', ev => {
            ev.preventDefault();
            ev.stopPropagation();
            console.log("GOT | Family Tree button clicked");
            if (typeof GOTFamilyTree !== 'undefined') {
                new GOTFamilyTree(this.actor).render(true);
            } else if (window.GOTFamilyTree) {
                new window.GOTFamilyTree(this.actor).render(true);
            } else {
                ui.notifications.error("Aplicação da Árvore Genealógica não encontrada no escopo global.");
                console.error("GOT | GOTFamilyTree class is missing.");
            }
        });

        // Effort System (SIFRP)
        html.find('.btn-toggle-esforco').click(async ev => {
            const current = this.actor.system.combate_intriga.esforco?.value || 0;
            const active = this.actor.system.combate_intriga.esforco_ativo;

            if (!active) {
                // Turning ON
                if (current <= 0) return ui.notifications.warn("Você não tem Esforço Diário suficiente!");
                await this.actor.update({
                    "system.combate_intriga.esforco.value": current - 1,
                    "system.combate_intriga.esforco_ativo": true
                });
                ui.notifications.info(`${this.actor.name} está se concentrando (Ignorando Lesões).`);
            } else {
                // Turning OFF
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

            // Chat Message
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

                // Sincronização Bidirecional
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

                    // Sincronização para Irmãos/Filhos
                    const otherLinhagem = foundry.utils.duplicate(actor.system.linhagem || {});
                    if (relType === "irmaos") {
                        if (!otherLinhagem.irmaos) otherLinhagem.irmaos = [];
                        if (!otherLinhagem.irmaos.includes(this.actor.id)) otherLinhagem.irmaos.push(this.actor.id);
                    } else if (relType === "filhos") {
                        // Se eu adiciono B como meu Filho, eu sou o Pai/Mãe de B
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

            // Sincronização de Remoção
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

            // Sincronização para Irmãos/Filhos
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

        // Apply Penalty
        const wounds = (Number(this.actor.system.combate_intriga?.lesoes?.value) || 0);
        const injuries = (Number(this.actor.system.combate_intriga?.ferimentos?.value) || 0);
        const frustration = (Number(this.actor.system.combate_intriga?.frustracao?.value) || 0);

        const poolPenalty = isCombate ? wounds : frustration;
        const resultPenalty = isCombate ? injuries : 0;

        // Detect Specialty Bonus (Rapidez for Combat Initiative)
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
        const itemData = { name: `Novo(a) ${type}`, type: "item", system: { type: type } };
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

        // Detect Specialty Bonus
        const specialtyName = (system.especialidade || "").trim();
        let specBonus = 0;
        if (specialtyName) {
            const normSpec = specialtyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ");
            const specs = this.actor.system.habilidades?.[abilityKey]?.especialidades || {};

            // Flexible search (matches 'armas de haste' with 'armas_de_haste')
            for (let [key, val] of Object.entries(specs)) {
                const normKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ");
                if (normKey === normSpec) {
                    specBonus = val;
                    break;
                }
            }
            console.log(`GOT | Weapon Roll - Specialty Detected: ${specialtyName} -> +${specBonus}B`);
        }

        // --- Powerful Attack (Ataque Poderoso) Mechanic ---
        let sacrificedDice = 0;
        let powerAttackMsg = "";
        let powerAttackDmgBonus = 0;
        if (this.actor.system.combate_intriga?.sacrificar_bonus) {
            sacrificedDice = specBonus;
            specBonus = 0; // Remove from roll
            if (sacrificedDice > 0) {
                // SIFRP Rule: Add Athletics rank to damage if bonus dice are sacrificed
                powerAttackDmgBonus = this.actor.system.habilidades?.atletismo?.base || 0;
                powerAttackMsg = `<br><b>Dados Sacrificados:</b> ${sacrificedDice} (Ataque Poderoso) <br><b>Dano Extra:</b> +${powerAttackDmgBonus}`;
            }
        }

        let attrKey = system.atributo_dano;
        // Fallback for existing items without the new property
        if (!attrKey) {
            if (esp.includes("curtas") || name.includes("adaga") || name.includes("faca") || name.includes("punhal") || name.includes("espada curta")) {
                attrKey = "agilidade";
            } else if (esp.includes("bestas") || name.includes("besta")) {
                attrKey = "agilidade"; // Crossbows add Agility to damage
            } else if (esp.includes("arcos") || name.includes("arco")) {
                attrKey = "agilidade"; // Bows add Agility to damage (SIFRP Rule)
            } else {
                attrKey = "atletismo";
            }
        }

        let ammoMsg = "";
        const ammoType = system.tipo_municao;

        if (ammoType) {
            console.log(`GOT | Looking for ammo: '${ammoType}'`);

            // Find ammo item
            // NOTE: Foundry Item type is 'item', our custom type is in system.type
            const ammoItem = this.actor.items.find(i => i.system.type === "equipamento" && i.system.is_ammo === true && (i.system.tipo_municao || "").trim().toLowerCase() === ammoType.trim().toLowerCase());

            if (ammoItem) {
                console.log(`GOT | Ammo found: ${ammoItem.name}`);
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
        const damage = (system.dano || 0) + attrVal + powerAttackDmgBonus;

        // Calculate Total AP for Attack Penalty
        let totalAP = 0;
        this.actor.items.forEach(i => {
            if (i.system.type === 'armadura' && i.system.uso) {
                totalAP += Number(i.system.ap || 0);
            }
        });

        // Apply Physical Penalty (SIFRP Rules)
        const woundsRaw = (Number(this.actor.system.combate_intriga?.lesoes?.value) || 0);
        const injuries = (Number(this.actor.system.combate_intriga?.ferimentos?.value) || 0);

        // Concentrate (Effort) Effect: Ignore exactly 1 wound (lesão)
        let effectiveWounds = woundsRaw;
        if (this.actor.system.combate_intriga?.esforco_ativo === true && effectiveWounds > 0) {
            effectiveWounds -= 1;
            console.log("GOT | Concentrate Active: Ignoring 1 Wound Penalty.");
        }

        // Apply AP to roll if weapon uses Agility
        const totalBonusDice = (system.bonus_dice || 0) + specBonus;
        const totalPoolCount = Math.max(1, ability + totalBonusDice - effectiveWounds);
        let rollFormula = `${totalPoolCount}d6kh${ability}`;
        if (injuries > 0) rollFormula += ` - ${injuries}`;
        if (attrKey === "agilidade" && totalAP !== 0) {
            rollFormula += ` ${totalAP > 0 ? '+' : ''}${totalAP}`;
        }

        const roll = new Roll(rollFormula);
        await roll.evaluate(); // V12 asynchronous evaluation

        // --- SIFRP TABLES 9-5 & 9-6 (Críticos e Fracassos) ---
        // Count all dice results (including bonus dice)
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

        // SIFRP Weapon Properties Scanner
        const props = (system.propriedades || "").toLowerCase();
        const desc = (system.description || "").toLowerCase();
        // Normalize text to remove accents (like ç and letters with marks)
        const fullText = `${name} ${props} ${desc}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        // Qualities Detection
        const isCruel = fullText.includes("cruel");
        const isPowerful = fullText.includes("poderosa") || fullText.includes("powerful");

        let propList = [];
        if (isCruel) propList.push("Cruel");
        if (isPowerful) propList.push("Poderosa");

        const pMatch = fullText.match(/(?:perfurante|piercing)\s*[+]?(\d+)/);
        const ignoredAR = pMatch ? Number(pMatch[1]) : (fullText.includes("perfurante") || fullText.includes("piercing") ? 1 : 0);
        if (ignoredAR > 0) propList.push(`Perfurante ${ignoredAR}`);

        if (fullText.includes("lenta") || fullText.includes("slow")) propList.push("Lenta");

        // Situational Reminders
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

        // Combat Automation
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

            // Apply Cruel bonus: Adds +2 per degree extra (making it total +3 per degree if normally +1)
            // But if norm is attrVal, we add +2 to attrVal per degree? 
            // User said: "+3 in place of +1". 
            // In character sheet code, the "1" is attrVal. 
            // So +3 would correspond to (attrVal + 2).
            const multiplier = attrVal + (isCruel ? 2 : 0);
            const extraDmg = multiplier * (degrees - 1);

            let finalDmg = damage + extraDmg + extraCritDmg;

            // Apply Powerful Bonus (if detected)
            let powerfulBonus = 0;
            if (isPowerful) {
                powerfulBonus = this.actor.system.habilidades?.atletismo?.base || 2;
                finalDmg += powerfulBonus;
                flavor += `<br><small>(Poderosa: +${powerfulBonus} Dano)</small>`;
            }

            // Apply Generic Damage Bonus (Dano +X)
            if (fullText.includes("dano +")) {
                const dMatch = fullText.match(/dano\s*[+]?(\d+)/);
                if (dMatch) {
                    const dBonus = Number(dMatch[1]);
                    finalDmg += dBonus;
                    flavor += `<br><small>(Bônus: +${dBonus} Dano)</small>`;
                }
            }

            // Quality: SLOW / LENTA (Requires Greater Action)
            if (fullText.includes("lenta") || fullText.includes("slow")) {
                flavor += `<br><small style="color:#d32f2f;">(Lenta: Exige Ação Maior)</small>`;
            }

            // Apply Armor Reduction
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
            } else {
                flavor += `<br><span style="color:red">Errou o ataque!</span>`;
            }
        } else {
            // No target or not combat
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

        // Determine Base Stat (Logic synchronization)
        const baseStats = CONFIG.GOT.unitBaseStats?.[system.tipo] || CONFIG.GOT.unitBaseStats?.["Infantaria"] || {};

        // Recalculate Ability: (Base for Type) + (Distributed Points)
        let ability = (baseStats[statKey] || 0) + parseInt(system.pontos?.[statKey] || 0);

        // Ensure minimum functional ability of 1 for rolls (official minimum)
        if (ability <= 0) ability = 1;

        // Training Bonus (Official SIFRP adds Bonus Dice)
        const trainingLevels = { "Recruta": 0, "Treinado": 1, "Veterano": 2, "Elite": 3 };
        let bonusDice = trainingLevels[system.treinamento] || 0;

        // Tactics Luta Bonus (+2B per point assigned in Tactics)
        // User Rule: "Luta (Tática) conta como +2B (Dados de Bônus)"
        if (statKey === "luta" && system.pontos && system.pontos.luta_tac) {
            const tactBonusPoints = parseInt(system.pontos.luta_tac);
            bonusDice += (tactBonusPoints * 2);
        }

        const totalDice = ability + bonusDice;
        const totalDiceRoll = totalDice;

        // Size Multiplier for Damage (Weighting)
        const sizeMap = { "Pelotão (10)": 1, "Unidade (100)": 2, "Batalhão (500)": 3, "Legião (1000)": 4 };
        const sizeReqMap = { "Pelotão (10)": 2, "Unidade (100)": 3, "Batalhão (500)": 4, "Legião (1000)": 5 };

        // Check Commander Warfare
        let warfare = 2; // Default
        if (system.comandante) {
            const cmd = game.actors.get(system.comandante);
            if (cmd) warfare = cmd.system.habilidades?.guerra?.base || 2;
        }

        let sizeMult = sizeMap[system.tamanho] || 1;
        const requiredWarfare = sizeReqMap[system.tamanho] || 2;
        let penaltyMsg = "";

        // PENALTY: If Warfare < Required, Damage Mult is 1
        if (warfare < requiredWarfare) {
            sizeMult = 1;
            penaltyMsg = `<br><span style="color:red; font-weight:bold;">⚠️ Penalidade de Comando!</span><br>Guerra insuficiente (${warfare} vs ${requiredWarfare}). Dano não multiplicado.`;
        }

        // Calculate Total Power (Base + Points)
        const basePower = CONFIG.GOT.unitBaseStats?.[system.tipo]?.["poder"] || CONFIG.GOT.unitBaseStats?.["Infantaria"]?.["poder"] || 1;

        let totalPower = basePower;
        if (system.pontos && system.pontos["poder"]) {
            totalPower += parseInt(system.pontos["poder"]);
        }

        const damage = totalPower * sizeMult;

        // Roll: {totalDice}d6kh{ability}
        const roll = new Roll(`${totalDiceRoll}d6kh${ability}`);
        await roll.evaluate(); // V12 asynchronous evaluation

        let flavor = `<b>Teste de ${statLabel} (Tropa)</b><br>`;
        flavor += `Treinamento: ${system.treinamento} (+${bonusDice}D)<br>`;

        if (statKey === "poder") {
            flavor = `<b>Rolagem de Dano (Tropa)</b><br>`;
            flavor += `Dano Total: <b>${damage}</b> (Poder ${totalPower} x${sizeMult} Tamanho)${penaltyMsg}`;
            // In SIFRP, damage isn't usually a roll but a fixed value + degrees of success. 
            // We'll output the value clearly.
            return ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                content: flavor
            });
        }

        if (["luta", "pontaria"].includes(statKey)) {
            flavor += `Dano Base: <b>${damage}</b> (Poder ${totalPower} x${sizeMult} Tamanho)${penaltyMsg}`;

            // Combat Automation
            const combat = this._calculateCombatResult(roll.total, "combat");
            if (combat) {
                const degrees = Math.max(1, combat.degrees);
                let finalDmg = damage + (degrees - 1);

                // Apply Armor Reduction
                let arMsg = "";
                if (combat.ar > 0) {
                    finalDmg = Math.max(0, finalDmg - combat.ar);
                    arMsg = ` (-${combat.ar} AR)`;
                }

                flavor += `<hr><b>Alvo:</b> ${combat.targetName}`;
                flavor += `<br>Defesa: ${combat.defense} | Margem: ${combat.margin >= 0 ? "+" : ""}${combat.margin}`;

                if (combat.margin >= 0) {
                    flavor += `<br>Graus de Sucesso: <b>${degrees}</b>`;
                    flavor += `<br>Dano Final: <b>${finalDmg}</b> (${damage} + ${degrees - 1} Graus${arMsg})`;
                    
                    // AUTO DAMAGE BUTTON
                    flavor += `<button class="apply-unit-damage-btn" data-target-id="${combat.targetId}" data-damage="${finalDmg}" style="margin-top: 5px; cursor: pointer; background: rgba(139, 0, 0, 0.8); color: white; border: 1px solid gold; border-radius: 3px; font-family: 'Alegreya', serif; font-weight: bold;"><i class="fas fa-sword"></i> Aplicar Dano</button>`;
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
            <option value="Tática">Tática</option>
            <option value="Comando">Comando</option>
            <option value="Estratégia">Estratégia</option>
          </select>
        </div>
        <div class="form-group"><label>Nível Necessário</label><input type="number" id="man-req" value="1"></div>
        <div class="form-group"><label>Bônus</label><input type="text" id="man-bonus" placeholder="+1D Luta"></div>
        <div class="form-group"><label>Descrição</label><textarea id="man-desc" placeholder="Efeito da manobra..."></textarea></div>
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
                <label>Nova Entrada de Histórico</label>
                <textarea id="note-text" style="width: 100%; height: 100px;" placeholder="Descreva o evento..."></textarea>
            </div>
        </form>`;

        new Dialog({
            title: "Adicionar Nota de Histórico",
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
                        ui.notifications.info("Nota adicionada ao histórico!");
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
        else if (category === "estrategia") budget = getCombinedSpec("estratégia") * 2; // try both spellings
        // Fallback for misspelled strategy/tactics if needed, though getCombinedSpec handles resolution if consistent
        if (budget === 0 && category === "estrategia") budget = getCombinedSpec("estrategia") * 2;
        else if (category === "tatica") budget = getCombinedSpec("tática") * 2;
        if (budget === 0 && category === "tatica") budget = getCombinedSpec("tatica") * 2;

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
                ui.notifications.warn("Sem pontos disponíveis nesta categoria de comando!");
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

        // Resolve Castelão and multipliers again for the dialog logic
        const hSenhor = game.actors.get(d.senhor)?.system.habilidades?.status || { especialidades: {} };
        const hAdmin = game.actors.get(d.castelao)?.system.habilidades?.status || { especialidades: {} };
        const gestao = (hAdmin.especialidades?.["gestão"] || hAdmin.especialidades?.gestao || 0) + (hSenhor.especialidades?.["gestão"] || hSenhor.especialidades?.gestao || 0);
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
            return ui.notifications.warn(`Limite de construções atingido (${limit})!`);
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
                const icons = { comida: "🍎", fortuna: "💰", ordem: "😄", defesa: "🛡️", populacao: "👥", soldados: "⚔️", max_estruturas: "🔨", influencia: "👑", poder: "👊", vida_muralha: "🧱" };
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
                    html.find('#preview-desc').html(`<strong>Descrição:</strong> ${selected.data('desc')}`);
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
                        ui.notifications.info(`"${config.name}" construído(a)!`);
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

        // Resolve leaders for Gestão bonus
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
            return ui.notifications.warn(`"${config.name}" já atingiu o nível máximo (${config.max_level || 5})!`);
        }

        // Hegemony Check
        if (id !== "castelo_principal" && struct.level >= castleLevel) {
            return ui.notifications.warn(`Você precisa aumentar o nível do Castelo Principal (Nvl ${castleLevel}) antes de evoluir esta estrutura!`);
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
        ui.notifications.info(`${config.name} evoluído para Nível ${struct.level}!`);
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
                <p>O tempo passou e as infraestruturas geraram rendimentos líquidos:</p>
                <ul style="list-style: none; padding: 0;">
                    <li>💰 <b>Fortuna:</b> +${net.fortuna} (Total: ${updates["system.dominio.fortuna"]})</li>
                    <li>🍎 <b>Comida:</b> +${i.comida} Ganhos | -${m.comida} Manutenção | <b>Saldo: ${net.comida >= 0 ? "+" : ""}${net.comida}</b></li>
                    <li>⚔️ <b>Poder:</b> +${net.poder} (Total: ${updates["system.dominio.poder"]})</li>
                    <li>👑 <b>Influência:</b> +${net.influencia} (Total: ${updates["system.dominio.influencia"]})</li>
                    <li>🛡️ <b>Defesa:</b> +${net.defesa} (Total: ${updates["system.dominio.defesa"]})</li>
                </ul>
                <p style="font-size: 0.8em; color: #666; margin-top: 10px;">Nota: Ordem Pública não aumenta automaticamente, depende de eventos ou estabilidade.</p>
            </div>
        </div>`;

        ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: chatContent
        });

        ui.notifications.info(`Mês avançado! Recursos e manutenção processados para ${this.actor.name}.`);
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
                            flavor += `<br>Influência: <b>${influence}</b> (Rank ${abilityRank} + ${degrees} Graus)`;
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
            const getVal = (k) => {
                const baseParams = CONFIG.GOT.unitBaseStats?.[m.tipo] || CONFIG.GOT.unitBaseStats?.["Infantaria"] || {};
                const base = baseParams[k] || 0;
                const added = parseInt(m.pontos?.[k] || 0);
                // Also check if k is "luta" and add luta_tac bonus if necessary
                if (k === "luta" && m.pontos?.luta_tac) {
                    // Note: Luta (Tac) adds +2B to the roll, but here we might need the Rank for some calculations
                    // Usually defense only uses Agi/Atl/Per, so this is mostly for completeness
                }
                return base + added;
            };
            const defBase = getVal("agilidade") + getVal("atletismo") + getVal("percepcao");
            const bonusDef = parseInt(m.bonus_defesa || 0);
            const defense = defBase + bonusDef;

            // Unit AR: (Training * 3) + Manual Bonus
            const trainingLevels = { "Recruta": 1, "Treinado": 2, "Veterano": 3, "Elite": 4 };
            const arBase = (trainingLevels[m.treinamento] || 1) * 3;
            const arBonus = parseInt(m.bonus_armadura || 0);
            const ar = arBase + arBonus;

            return { defense, intrigueDefense: 0, ar };
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
        label: "Ficha de Crônicas de Gelo e Fogo"
    });

    CONFIG.GOT = {
        habilidades: {
            agilidade: "Agilidade", lidar_com_animais: "Lidar com Animais", atletismo: "Atletismo", percepcao: "Percepção",
            astucia: "Astúcia", enganacao: "Enganação", resistencia: "Resistência", luta: "Luta", cura: "Cura", idioma: "Idioma",
            conhecimento: "Conhecimento", pontaria: "Pontaria", persuasao: "Persuasão", status: "Status",
            furtividade: "Furtividade", sobrevivencia: "Sobrevivência", guerra: "Guerra", vontade: "Vontade"
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
                guerra: { base: 2, especialidades: { comando: 0, estratégia: 0, tática: 0 } },
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
            "Camponês": { luta: 2, agilidade: 2, atletismo: 2, disciplina: 1, pontaria: 1, movimento: 3, poder: 1, percepcao: 2 },
            "Arqueiros Montados": { luta: 2, agilidade: 3, atletismo: 3, disciplina: 2, pontaria: 4, movimento: 6, poder: 2, percepcao: 3 }
        },

        structures: {
            castelo_principal: { name: "Castelo Principal", desc: "A sede do poder. Onde o senhor reside e governa. Necessário para evoluir outras estruturas.", cost: { fortuna: 40, poder: 10 }, bonus: { max_estruturas: 1, populacao: 150, influencia: 10, defesa: 10 } },
            centro_urbano: { name: "Centro Urbano", desc: "Coração da cidade. Define limites de expansão.", cost: { fortuna: 15 }, bonus: { max_estruturas: 3, populacao: 3000, soldados: 50 } },
            fazenda: { name: "Fazenda", desc: "Produção básica de cereais e vegetais.", cost: { fortuna: 5 }, bonus: { comida: 15 } },
            celeiro: { name: "Celeiro", desc: "Armazena e gera grãos.", cost: { fortuna: 5 }, bonus: { comida: 5 } },
            mercado: { name: "Mercado", desc: "Aumenta o comércio local.", cost: { fortuna: 10 }, bonus: { fortuna: 5 } },
            prisao: { name: "Prisões", desc: "Mantém criminosos longe das ruas.", cost: { fortuna: 10, poder: 5 }, bonus: { ordem: 30 } },
            estalagem: { name: "Estalagem", desc: "Melhora o moral com lazer.", cost: { fortuna: 5, poder: 2 }, bonus: { ordem: 15 } },
            teatro: { name: "Teatro", desc: "Cultura e entretenimento para o povo.", cost: { fortuna: 15, poder: 5 }, bonus: { ordem: 25, influencia: 2 }, req: { gestao: 1, torneios: 1 } },
            coliseu: { name: "Coliseu", desc: "Grandes jogos e demonstrações de glória.", cost: { fortuna: 30, poder: 15 }, bonus: { ordem: 40, poder: 5, influencia: 5 }, req: { torneios: 3 } },
            quartel: { name: "Quartel", desc: "Treinamento e alojamento de tropas.", cost: { fortuna: 15, poder: 10 }, bonus: { poder: 10, defesa: 20, soldados: 40 } },
            oficina: { name: "Oficina de Cerco", desc: "Engenharia para armas de cerco e reparos.", cost: { fortuna: 20, poder: 5 }, bonus: { defesa: 5 } },
            ferreiro: { name: "Ferreiro", desc: "Equipa tropas com aço de qualidade.", cost: { fortuna: 15, poder: 5 }, bonus: { defesa: 3, fortuna: 1 } },
            porto: { name: "Porto", desc: "Comércio marítimo e construção naval.", cost: { fortuna: 25 }, bonus: { fortuna: 5, comida: 2 } },
            coutada: { name: "Coutada de Caça", desc: "Produção de carne e recursos silvestres.", cost: { fortuna: 5 }, bonus: { comida: 3 } },
            caserna: { name: "Caserna", desc: "Melhora a ordem através da guarda.", cost: { fortuna: 10, poder: 5 }, bonus: { ordem: 20 } },
            acampamento: { name: "Acampamento", desc: "Aumenta a capacidade de manter tropas em campo.", cost: { fortuna: 5, poder: 2 }, bonus: { soldados: 2500 } },
            estabulo: { name: "Estábulo", desc: "Cria infraestrutura para cavalos e montarias.", cost: { fortuna: 10, poder: 5 }, bonus: { poder: 5, defesa: 10, soldados: 20 } },

            // BONUS BUILDINGS (Gestão 3+)
            grande_biblioteca: { name: "Grande Biblioteca", desc: "Centro de saber e prestígio.", cost: { fortuna: 20, poder: 10 }, bonus: { influencia: 15 }, req: { gestao: 3 } },
            guilda_mercadores: { name: "Guilda de Mercadores", desc: "Associação comercial para gerar riqueza.", cost: { fortuna: 30 }, bonus: { fortuna: 20 }, req: { gestao: 3 } },
            academia_militar: { name: "Academia Militar", desc: "Elite do treinamento militar.", cost: { fortuna: 30, poder: 20 }, bonus: { defesa: 5, soldados: 100 }, req: { gestao: 3 } },
            muralha: { name: "Muralha", desc: "Fortificação defensiva que protege o feudo.", cost: { fortuna: 15, poder: 5 }, bonus: { defesa: 5, vida_muralha: 10 } },
            esconderijo_espioes: { name: "Esconderijo dos Espiões", desc: "Centro de inteligência para recrutamento de agentes e proteção interna.", cost: { fortuna: 20, poder: 5 }, bonus: { influencia: 5, ordem: 10 }, req: { gestao: 2 } },
            mina_ouro: { name: "Mina de Ouro", desc: "Exploração de veios de metal precioso para financiar o reino.", cost: { fortuna: 40 }, bonus: { fortuna: 20 }, req: { gestao: 3 } },
            academia: { name: "Academia", desc: "Instituição de ensino superior para formação de burocratas e acadêmicos.", cost: { fortuna: 25, poder: 5 }, bonus: { influencia: 10, fortuna: 2 }, req: { gestao: 4 } },
            mina_ferro: { name: "Mina de Ferro", desc: "Extração de minério de ferro para impulsionar a economia e a forja de armas.", cost: { fortuna: 25, poder: 5 }, bonus: { fortuna: 10, poder: 5, defesa: 2 } },
            vinhedo: { name: "Vinhedo", desc: "Produção de vinhos finos que geram grande riqueza e prestígio para a casa.", cost: { fortuna: 20 }, bonus: { fortuna: 12, influencia: 2 } },
            pomar: { name: "Pomar", desc: "Cultivo de frutas diversas, garantindo suprimentos e um pequeno lucro comercial.", cost: { fortuna: 10 }, bonus: { comida: 10, fortuna: 2 } },
            casa_escravos: { name: "Casa dos Escravos", desc: "Onde os trabalhadores forçados de guerra vão ficar. Centraliza a mão de obra cativa, expandindo a capacidade produtiva e diminuindo a insatisfação geral através do trabalho compulsório organizado.", cost: { fortuna: 15, poder: 10 }, bonus: { fortuna: 15, populacao: 1000 } },
            templo: { name: "Templo", desc: "Local sagrado para contemplação religiosa (Septos, Bosques Sagrados, Templos). Promove a paz espiritual e a ordem social entre os habitantes.", cost: { fortuna: 15, poder: 5 }, bonus: { ordem: 20, influencia: 5, fortuna: 5 } }
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
        if (isUnit) {
            const m = system.militar || {};

            // Recalculate max health for HUD (matches _prepareUnitData logic)
            const sizeHealthMap = { "Pelotão (10)": 0, "Unidade (100)": 10, "Batalhão (500)": 25, "Legião (1000)": 50 };
            const sizeBonus = Number(sizeHealthMap[m.tamanho || "Pelotão (10)"] || 0);
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
        }

        const healthPct = health.max > 0 ? Math.min(100, (health.value / health.max) * 100) : 0;
        const effortPct = effort.max > 0 ? Math.min(100, (effort.value / effort.max) * 100) : 0;

        // Movement Data (Energy Bar)
        let moveBase = Number(system.combate_intriga?.movimento || 0);

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
            const moveSquaresBase = Math.floor((moveBase * 0.91) / 1.5);
            const moveSquaresSprint = Math.floor(((moveBase * 4) * 0.91) / 1.5);
            moveSquaresTotal = isSprinting ? moveSquaresSprint : moveSquaresBase;
        }

        const moveSquaresRemainingNum = Math.max(0, (moveSquaresTotal - distanceMovedSquares));
        const moveSquaresRemaining = moveSquaresRemainingNum.toFixed(1);
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
            { id: "fintar", name: "Fintar", icon: "fas fa-mask", type: "Enganação", typeAction: "maior", ability: "enganacao", spec: "astucia" },
            { id: "imobilizar", name: "Imobilizar", icon: "fas fa-anchor", type: "Atletismo", typeAction: "maior", ability: "atletismo", spec: "forca" },
            { id: "passar", name: "Passar", icon: "fas fa-hourglass-half", type: "maior" },
            { id: "puxar_cavaleiro", name: "Puxar Cavaleiro", icon: "fas fa-user-injured", type: "Luta", typeAction: "maior", ability: "atletismo", spec: "forca" },
            { id: "recuperar_folego", name: "Recuperar Fôlego", icon: "fas fa-heartbeat", type: "Vigor", typeAction: "maior", ability: "vigor" },
            { id: "atq_dividido", name: "Atq. Dividido", icon: "fas fa-share-alt", type: "maior" },
            { id: "atq_duas_armas", name: "Atq. 2 Armas", icon: "fas fa-sword", type: "maior" },
            { id: "atq_montado", name: "Atq. Montado", icon: "fas fa-horse-head", type: "maior", ability: "luta" }
        ];

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
            qualities,
            destinyCurrent,
            destinyMax,
            isCombat: !!game.combat,
            isUnit: isUnit,
            moveSquaresTotal,
            moveSquaresRemaining,
            movePct,
            activeTab: this.activeTab
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
            const id = ev.currentTarget.dataset.id;
            const name = ev.currentTarget.dataset.name.toUpperCase();
            const actor = this.activeToken.actor;

            const descriptions = {
                "ajudar": "Concede +1D em um teste de um aliado ou +2 na Defesa dele até o início do seu próximo turno. (Ação Menor)",
                "interagir": "Realizar tarefas simples como abrir uma porta, pegar um item do chão, sacar uma arma ou montar em um cavalo. (Ação Menor)",
                "levantar": "Levantar-se do chão consome uma ação menor e não provoca ataques de oportunidade. (Ação Menor)",
                "mover": "Permite mover-se uma distância de quadrados igual à sua Graduação em Atletismo. (Ação Menor)",
                "carga": "Move-se e ataca em uma única ação. Recebe -1D no teste de Luta, mas soma +2 no Dano final. (Ação Maior)",
                "corrida": "Move-se uma distância de quadrados igual a 4x sua Graduação em Atletismo. (Ação Maior)",
                "derrubar": "Teste de Atletismo (Força) ou Luta (Briga) contra a Defesa Passiva do alvo para deixá-lo caído. (Ação Maior)",
                "desarmar": "Teste de Luta contra a Defesa do alvo para tentar remover a arma das mãos dele. (Ação Maior)",
                "esquiva": "Realiza um teste de Agilidade (Esquiva). O resultado substitui sua Defesa contra todos os ataques até o próximo turno. (Ação Maior)",
                "fintar": "Teste de Enganação (Astúcia) contra a Defesa do alvo. Se vencer, ganha +1D no próximo ataque e ignora o bônus de Defesa do alvo. (Ação Maior)",
                "imobilizar": "Teste de Atletismo (Força) contra Atletismo para agarrar e imobilizar o alvo, impedindo-o de agir livremente. (Ação Maior)",
                "passar": "Fica em guarda aguardando uma oportunidade. Recebe +2B no próximo teste ou ação de ataque. (Ação Maior)",
                "puxar_cavaleiro": "Teste de Atletismo (Força) contra o Atletismo do cavaleiro para tentar derrubá-lo da montaria. (Ação Maior)",
                "recuperar_folego": "Teste de Vigor para recuperar 1 de Ferimento sofrido ou 1 ponto de Esforço gasto nesta cena. (Ação Maior)",
                "atq_dividido": "Permite dividir seus dados de Luta ou Pontaria para atacar múltiplos alvos em um único turno. (Ação Maior)",
                "atq_duas_armas": "Ataque com uma arma em cada mão. Aplica as penalidades de mão inábil conforme as regras de combate. (Ação Maior)",
                "atq_montado": "Ataque realizado enquanto montado. Recebe +1B em testes de Luta contra alvos que estejam a pé. (Ação Maior)"
            };

            const content = `
            <div class="got-chat-card maneuver-card">
                <header class="card-header">
                    <i class="${ev.currentTarget.querySelector('i').className}"></i>
                    <h3>${name}</h3>
                </header>
                <div class="card-content">
                    <p>${descriptions[id] || "Descrição da manobra não encontrada."}</p>
                </div>
            </div>
        `;

            await ChatMessage.create({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: content
            });
            ui.notifications.info(`Manobra [${name}] enviada ao chat.`);
        });

        // Qualities (Powers) - Send to Chat
        html.find('.hud-quality').click(async ev => {
            const itemId = ev.currentTarget.dataset.itemId;
            const item = this.activeToken.actor.items.get(itemId);
            if (!item) return;

            const content = `
                <div class="got-chat-card">
                    <header class="card-header">
                        <img src="${item.img}" width="36" height="36"/>
                        <h3>${item.name}</h3>
                    </header>
                    <div class="card-content">
                        ${item.system.description || "Sem descrição."}
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
                    content: "<p>Tem certeza? Queimar um ponto de destino o remove <b>permanentemente</b> da ficha, reduzindo seu total máximo.</p>"
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
                return ui.notifications.error("Esforço insuficiente para Ataque Extra!");
            }

            await actor.update({ "system.combate_intriga.esforco.value": effort.value - 1 });
            ui.notifications.info(`Ataque Extra! Gastou 1 de Esforço (Restante: ${effort.value - 1})`);

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
            if (!game.combat) return ui.notifications.warn("Não há combate ativo!");
            const currentActorId = game.combat.combatant?.actorId;
            if (currentActorId !== this.activeToken.actor.id) return ui.notifications.warn("Não é o seu turno!");
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

        // --- 1. RESOLVE LEADERS (Commander & Sub-commander) ---
        const resolveLeaderData = (id) => {
            if (!id) return null;
            const a = game.actors.get(id);
            if (!a) return null;
            const h = a.system.habilidades?.guerra || { base: 2, especialidades: {} };
            return {
                id: a.id,
                name: a.name,
                img: a.img,
                warfare: Number(h.base || 2),
                comando: Number(h.especialidades?.comando || 0),
                estrategia: Number(h.especialidades?.["estratégia"] || h.especialidades?.estrategia || 0),
                tatica: Number(h.especialidades?.["tática"] || h.especialidades?.tatica || 0)
            };
        };

        const comandante = resolveLeaderData(m.comandante);
        const subcomandante = resolveLeaderData(m.subcomandante);

        const getCombinedSpec = (key) => (comandante?.[key] || 0) + (subcomandante?.[key] || 0);

        // --- 2. STATS & ATTACK ---
        const tacticsBonus = (Number(m.pontos?.luta_tac || 0)) * 2;
        const powerBase = (Number(m.poder || 0) + (Number(m.pontos?.poder || 0)));

        const sizeMultMap = { "Pelotão (10)": 1, "Unidade (100)": 2, "Batalhão (500)": 3, "Legião (1000)": 4 };
        const sizeMultiplierBase = sizeMultMap[m.tamanho || "Pelotão (10)"] || 1;

        const commanderWarfare = comandante?.warfare || 0;
        const sizeReqMap = { "Pelotão (10)": 1, "Unidade (100)": 2, "Batalhão (500)": 3, "Legião (1000)": 4 };
        const reqWarfare = sizeReqMap[m.tamanho || "Pelotão (10)"] || 1;
        const hasCommandPenalty = commanderWarfare < reqWarfare;

        const sizeMultiplier = hasCommandPenalty ? 1 : sizeMultiplierBase;
        const unitDamage = powerBase * sizeMultiplier;

        // --- 3. TARGETING (Auto-Damage Calculation) ---
        const targetToken = game.user.targets.size > 0 ? Array.from(game.user.targets)[0] : null;
        let targetInfo = null;
        if (targetToken) {
            const tActor = targetToken.actor;
            const tSys = tActor?.system;
            const isTargetUnit = tSys?.tipo_ficha === "unit";

            let tDef = 0;
            let tArm = 0;

            if (isTargetUnit) {
                const tm = tSys.militar || {};
                const tAgi = Number(tm.agilidade || 2);
                const tAtl = Number(tm.atletismo || 2);
                const tPer = Number(tm.percepcao || 2);
                tDef = tAgi + tAtl + tPer + Number(tm.bonus_defesa || 0);
            } else {
                tDef = Number(tSys?.combate_intriga?.defesa || 0);
                tArm = Number(tSys?.combate_intriga?.armadura || 0);
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

        // --- 4. MANEUVERS (Recalculate & Rebalance) ---
        const activeStance = m.posturaAtiva || "";

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

        const dynamicManeuvers = (maneuversMap[m.tipo] || maneuversMap["Infantaria"]).map(man => {
            const specKey = man.specialty.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const combined = getCombinedSpec(specKey === "tatica" ? "tatica" : specKey === "estrategia" ? "estrategia" : "comando");
            return {
                ...man,
                met: combined >= man.req,
                active: man.isStance && activeStance === man.name
            };
        });

        const customManeuvers = (m.manobras_custom || []).map(man => {
            const specKey = (man.specialty || "Tática").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const combined = getCombinedSpec(specKey === "tatica" ? "tatica" : specKey === "estrategia" ? "estrategia" : "comando");
            return { ...man, met: combined >= (man.req || 0) };
        });

        // --- 5. VITALS & DEFENSE ---
        const sizeHealthMap = { "Pelotão (10)": 0, "Unidade (100)": 10, "Batalhão (500)": 25, "Legião (1000)": 50 };
        const sizeHealthBonus = sizeHealthMap[m.tamanho || "Pelotão (10)"] || 0;
        const discRank = Number(m.disciplina || 2);
        const healthMax = (discRank * 3) + sizeHealthBonus;
        const healthValue = Number(m.saude?.value ?? healthMax);
        const healthPct = Math.min(100, (healthValue / healthMax) * 100);

        const disciplineMax = discRank;
        const disciplineValue = (m.moral !== undefined) ? Number(m.moral) : disciplineMax;
        const disciplinePct = Math.min(100, (disciplineValue / disciplineMax) * 100);

        const isFleeing = (healthValue <= 0 || disciplineValue <= 0);

        const unitDefense = (Number(m.agilidade || 2) + Number(m.atletismo || 2) + Number(m.percepcao || 2)) + Number(m.bonus_defesa || 0);

        // --- 6. MOVEMENT TRACKING ---
        const moveBase = Number(m.movimento || 1);
        const distanceMoved = this.activeToken.document.getFlag("got-character-sheet", "distanciaMovida") || 0;
        const moveRemainingNum = Math.max(0, moveBase - distanceMoved);
        const moveRemaining = moveRemainingNum.toFixed(1);
        const movePct = moveBase > 0 ? Math.min(100, (moveRemainingNum / moveBase) * 100) : 0;

        return {
            actor,
            token: this.activeToken,
            system,
            healthValue, healthMax, healthPct,
            disciplineValue, disciplineMax, disciplinePct,
            isFleeing,
            tacticsBonus,
            powerBase, sizeMultiplier, unitDamage,
            hasCommandPenalty,
            points: { used: m.pontos?.total_usado || 0, total: m.pontos?.total_disponivel || 0 },
            unitDefense,
            moveBase, moveRemaining, movePct,
            dynamicManeuvers, customManeuvers,
            activeTab: this.activeTab,
            activeStance,
            isCombat: !!game.combat,
            comandante, subcomandante,
            target: targetInfo
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
            const isStance = data.isStance === "true";

            // If it's a stance, toggle it on/off
            if (isStance) {
                const currentStance = actor.system.militar.posturaAtiva || "";
                const newStance = (currentStance === data.name) ? "" : data.name;
                await actor.update({ "system.militar.posturaAtiva": newStance });

                if (newStance) {
                    ui.notifications.info(`${actor.name} assumiu a postura: ${newStance}`);
                } else {
                    ui.notifications.info(`${actor.name} desativou sua postura.`);
                }
            }

            const content = `
                <div class="got-chat-card maneuver-card">
                    <header class="card-header">
                        <img src="${actor.img}" title="${actor.name}"/>
                        <h3>${data.name}</h3>
                    </header>
                    <div class="card-content">
                        <div class="maneuver-info">
                            <span><strong>Requisito:</strong> ${data.specialty} ${data.req}</span><br>
                            <span><strong>Benefício:</strong> ${data.bonus}</span>
                        </div>
                        <hr>
                        <p class="maneuver-description">${data.desc}</p>
                    </div>
                </div>
            `;

            await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                content: content,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER
            });
        });

        html.find('.recovery-btn').click(async ev => {
            if (ev.currentTarget.classList.contains('disabled')) return;
            const actor = this.activeToken.actor;
            const discipline = actor.system.militar.moral;

            if (discipline <= 0) return ui.notifications.error("Sem Disciplina para reagrupar!");

            const comandante = actor.getFlag("got-character-sheet", "comandanteData");
            const warfare = comandante ? (comandante.warfare || 0) : 0;
            const comando = comandante ? (comandante.comando || 0) : 0;

            const formula = `${warfare + comando}d6kh${warfare}`;
            const roll = new Roll(formula);
            await roll.evaluate();

            await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Tentativa de Reagrupar Unidade (Comando)" });

            if (roll.total >= 9) {
                await actor.update({ "system.militar.moral": discipline - 1 });
                ui.notifications.info("Unidade Reagrupada!");
            } else {
                await actor.update({ "system.militar.moral": discipline - 1 });
                ui.notifications.warn("Falha ao reagrupar!");
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

Hooks.once("ready", () => {
    console.log("GOT | Ready - Token Detection");
    // Auto-detect controlled token on start
    const controlled = canvas.tokens?.controlled || [];
    if (controlled.length > 0) {
        game.gotHUD.updateToken(controlled[0]);
    }
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


Hooks.on("updateCombat", async (combat, update, options, userId) => {
    if (!("turn" in update || "round" in update)) return;

    // Reset movement flags and sprint for the actor whose turn it is
    const activeCombatant = combat.combatant;
    const actor = activeCombatant?.actor;
    if (actor) {
        console.log(`GOT | Turn Change - Resetting movement for ${actor.name}`);
        await actor.update({ "system.combate_intriga.sprint_ativo": false });
        const token = actor.getActiveTokens()[0];
        if (token) {
            await token.document.setFlag("got-character-sheet", "distanciaMovida", 0);
        }
    }

    if (game.gotHUD?.enabled && game.gotHUD?.activeToken) game.gotHUD.render();
});

Hooks.on("preUpdateToken", (tokenDoc, update, options, userId) => {
    if (!game.combat) return; // Only track in combat
    if (!("x" in update || "y" in update)) return;

    const actor = tokenDoc.actor;
    if (!actor) return;

    // Points for distance calculation
    const p0 = { x: tokenDoc.x, y: tokenDoc.y };
    const p1 = {
        x: "x" in update ? update.x : p0.x,
        y: "y" in update ? update.y : p0.y
    };

    if (p0.x === undefined || p1.x === undefined) return;

    // Use Foundry V12 grid measurement
    const path = canvas.grid.measurePath([p0, p1]);
    const gridDist = canvas.scene.grid.distance || 1.5;
    const squaresMoved = path.distance / gridDist;

    if (squaresMoved > 0) {
        const currentDist = tokenDoc.getFlag("got-character-sheet", "distanciaMovida") || 0;
        const newDist = currentDist + squaresMoved;

        // Inject flag directly into the current update transaction
        if (!update.flags) update.flags = {};
        if (!update.flags["got-character-sheet"]) update.flags["got-character-sheet"] = {};
        update.flags["got-character-sheet"].distanciaMovida = newDist;

        console.log(`GOT | Movement Sync - Squares: ${squaresMoved.toFixed(2)} | Total: ${newDist.toFixed(2)} qd`);
    }
});

// Real-time HUD update when token moves (WASD support)
Hooks.on("updateToken", (tokenDoc, update, options, userId) => {
    if (!game.combat) return;

    const isMovement = ("x" in update || "y" in update);
    const isFlagUpdate = (update.flags?.["got-character-sheet"]?.distanciaMovida !== undefined);

    if (!isMovement && !isFlagUpdate) return;

    // Combat HUD (K)
    if (game.gotHUD?.enabled && game.gotHUD?.activeToken?.id === tokenDoc.id) {
        if (isMovement) {
            if (game.gotHUD._renderTimeout) clearTimeout(game.gotHUD._renderTimeout);
            game.gotHUD._renderTimeout = setTimeout(() => {
                game.gotHUD.render();
            }, 50);
        } else {
            game.gotHUD.render();
        }
    }

    // Battle HUD (G)
    if (game.gotBattleHUD?.enabled && game.gotBattleHUD?.activeToken?.id === tokenDoc.id) {
        if (isMovement) {
            if (game.gotBattleHUD._renderTimeout) clearTimeout(game.gotBattleHUD._renderTimeout);
            game.gotBattleHUD._renderTimeout = setTimeout(() => {
                game.gotBattleHUD.render();
            }, 50);
        } else {
            game.gotBattleHUD.render();
        }
    }
});

// Real-time HUD update when Actor changes (Health, Effort, etc.)
Hooks.on("updateActor", (actor, update, options, userId) => {
    if (game.gotHUD?.enabled && game.gotHUD.activeToken?.actor.id === actor.id) {
        game.gotHUD.render();
    }
    if (game.gotBattleHUD?.enabled && game.gotBattleHUD.activeToken?.actor.id === actor.id) {
        game.gotBattleHUD.render();
    }
});

Hooks.on("updateCombat", async (combat, update, options, userId) => {
    if (!("turn" in update || "round" in update)) return;

    // Reset movement flag for the next actor's token
    const combatant = combat.combatant;
    const actor = combatant?.actor;
    if (actor) {
        const token = actor.getActiveTokens()[0];
        if (token) {
            await token.document.setFlag("got-character-sheet", "distanciaMovida", 0);
        }
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

// Handle Unit Damage Application from Chat
Hooks.on(" renderChatMessage\, (app, html, data) => {
 html.find(\.apply-unit-damage-btn\).click(async ev => {
 ev.preventDefault();
 const btn = ev.currentTarget;
 const targetId = btn.dataset.targetId;
 const damage = parseInt(btn.dataset.damage);

 if (!targetId) return ui.notifications.warn(\Alvo n�o encontrado nesta mensagem.\);

 const targetActor = game.actors.get(targetId) || canvas.tokens.get(targetId)?.actor;
 if (!targetActor) return ui.notifications.error(\N�o foi poss�vel encontrar o ator do alvo.\);

 if (targetActor.system.tipo_ficha === \unit\) {
 const currentHealth = targetActor.system.militar.saude.value;
 const newHealth = Math.max(0, currentHealth - damage);
 await targetActor.update({ \system.militar.saude.value\: newHealth });
 ui.notifications.info(Dano aplicado! sofreu de dano.);
 
 btn.disabled = true;
 btn.style.opacity = \0.5\;
 btn.innerText = \Dano Aplicado\;
 } else {
 ui.notifications.warn(\Este bot�o � exclusivo para combate de unidades.\);
 }
 });
});
