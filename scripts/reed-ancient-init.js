/**
 * GoT House Reed - V3 (Clean & Direct)
 * Initializes legendary characters with full SIFRP stats.
 * Target: Greywater Watch (Atalaia da Água Cinzenta).
 */

async function initializeReedAncient() {
    const eraName = "Norte: Era dos Heróis";
    const eraColor = "#228b22";

    const houseContent = {
        name: "Casa Reed",
        history: "<h2>Casa Reed: Os Senhores do Pântano</h2><p>Governam o Gargalo a partir da Atalaia da Água Cinzenta, uma fortaleza que se move sobre as águas.</p>",
        characters: [
            {
                name: "Lorde Howland Reed (Ancestral)",
                info: { idade: 55, genero: "Masculino", casa: "Casa Reed", pontos_destino: 4 },
                biografia: "O sábio senhor do Gargalo. Honrado e cauteloso, ele governa seu povo com justiça e desconhece totalmente as intrigas sombrias que ocorrem nos corredores da Atalaia.",
                habilidades: {
                    astucia: { base: 6, especialidades: { logica: 4 } },
                    conhecimento: { base: 5, especialidades: { educacao: 3, pesquisa: 3 } },
                    vontade: { base: 5, especialidades: { dedicacao: 4 } },
                    percepcao: { base: 5 }
                }
            },
            {
                name: "General 'Sombra do Pântano'",
                info: { idade: 48, genero: "Masculino", casa: "Casa Reed", pontos_destino: 2 },
                biografia: "Mestre da guerra de guerrilha. Suas tropas desaparecem na névoa antes que o inimigo possa desembainhar o aço.",
                habilidades: {
                    guerra: { base: 6, especialidades: { comando: 5, estrategia: 4, tatica: 4 } },
                    furtividade: { base: 6, especialidades: { esgueirar_se: 5 } },
                    luta: { base: 5, especialidades: { lancas: 4 } },
                    sobrevivencia: { base: 5, especialidades: { orientacao: 4 } }
                }
            },
            {
                name: "Vyman Reed (O Ardiloso)",
                info: { idade: 42, genero: "Masculino", casa: "Casa Reed", pontos_destino: 1 },
                biografia: "O mestre dos sussurros. Agindo nas sombras e pelas costas de seu suserano, ele orquestrou a morte de Helena por acreditar que sua existência era uma ameaça à estabilidade do Norte. Ele carrega esse segredo como um fardo necessário para a preservação do reino.",
                habilidades: {
                    intrigas: { base: 6, especialidades: { conspirar: 6, decifrar_motivacao: 4 } },
                    astucia: { base: 6, especialidades: { desmascarar: 5 } },
                    furtividade: { base: 6, especialidades: { misturar_se: 4 } },
                    persuasao: { base: 5, especialidades: { enganar: 4 } }
                }
            },
            {
                name: "Meera Reed (Ancestral)",
                info: { idade: 22, genero: "Feminino", casa: "Casa Reed", pontos_destino: 3 },
                biografia: "Uma caçadora e guerreira nata. Suas redes e lanças de bronze não perdem o alvo.",
                habilidades: {
                    luta: { base: 6, especialidades: { lancas: 5 } },
                    atletismo: { base: 5, especialidades: { escalar: 4, nadar: 4 } },
                    sobrevivencia: { base: 6, especialidades: { orientacao: 4, forragear: 3 } },
                    agilidade: { base: 5 }
                }
            }
        ]
    };

    console.log("Iniciando Criação da Casa Reed (V3)...");

    // 1. Root Folder
    let eraFolder = game.folders.find(f => f.name === eraName && f.type === "Actor");
    if (!eraFolder) eraFolder = await Folder.create({ name: eraName, type: "Actor", color: eraColor });

    // 2. House Folder
    let houseFolder = game.folders.find(f => f.name === houseContent.name && f.folder === eraFolder.id);
    if (!houseFolder) houseFolder = await Folder.create({ name: houseContent.name, type: "Actor", folder: eraFolder.id });

    // 3. Characters
    for (const char of houseContent.characters) {
        let existing = game.actors.find(a => a.name === char.name && a.folder === houseFolder.id);
        if (existing) {
            console.log(`Personagem já existe: ${char.name}`);
            continue;
        }

        const actor = await Actor.create({
            name: char.name,
            type: "character",
            folder: houseFolder.id,
            system: {
                info: char.info,
                biografia: char.biografia,
                habilidades: char.habilidades,
                tipo_ficha: "character"
            }
        });
        console.log(`Criado: ${char.name} (Pasta: ${houseContent.name})`);
    }

    ui.notifications.info("Casa Reed V3 (Limpa) inicializada com sucesso!");
}

initializeReedAncient();
