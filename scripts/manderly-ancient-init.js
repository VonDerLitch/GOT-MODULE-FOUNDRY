/**
 * GoT House Manderly - V3 (Clean & Direct)
 * Initializes legendary characters as literal MERMEN with full SIFRP stats.
 * Target: Porto Branco / Faca Branca (Norte).
 */

async function initializeManderlyAncient() {
    const eraName = "Norte: Era dos Heróis";
    const eraColor = "#228b22";

    const houseContent = {
        name: "Casa Manderly",
        history: "<h2>Casa Manderly: Os Senhores do Tridente de Prata</h2><p>Vassalos leais de Winterfell, os Manderly são descendentes de uma linhagem lendária de tritões que emergiram do mar e juraram lealdade aos Reis do Inverno.</p>",
        characters: [
            {
                name: "Lorde Desmond Manderly",
                info: { idade: 52, genero: "Masculino", casa: "Casa Manderly", pontos_destino: 4 },
                biografia: "O Senhor do Tridente. Um tritão robusto com escamas prateadas nos braços e pescoço, e uma longa cabeleira verde-escura. Ele governa as águas do Porto Branco.",
                habilidades: {
                    status: { base: 6, especialidades: { gestao: 4, linhagem: 3 } },
                    atletismo: { base: 5, especialidades: { nadar: 5 } },
                    persuasao: { base: 5, especialidades: { barganhar: 4 } },
                    conhecimento: { base: 4 }
                }
            },
            {
                name: "General 'O Tridente de Ferro'",
                info: { idade: 45, genero: "Masculino", casa: "Casa Manderly", pontos_destino: 2 },
                biografia: "O terror dos mares. Este general tritão lidera as frotas e guardas aquáticas dos Manderly. Suas escamas são endurecidas como couro e ele empunha um tridente de bronze ancestral.",
                habilidades: {
                    guerra: { base: 6, especialidades: { comando: 5, tatica: 5, estrategia: 4 } },
                    atletismo: { base: 6, especialidades: { nadar: 6, forca: 4 } },
                    luta: { base: 6, especialidades: { lancas: 6 } },
                    resistencia: { base: 5 }
                }
            },
            {
                name: "Wylla Manderly (Ancestral)",
                info: { idade: 19, genero: "Feminino", casa: "Casa Manderly", pontos_destino: 3 },
                biografia: "Uma jovem sereia de cabelos verdes vibrantes. Embora gentil, ela possui a ferocidade dos rios do Norte em seu sangue.",
                habilidades: {
                    vontade: { base: 5, especialidades: { coragem: 4 } },
                    percepcao: { base: 5, especialidades: { empatia: 3 } },
                    atletismo: { base: 4, especialidades: { nadar: 5 } },
                    persuasao: { base: 4 }
                }
            },
            {
                name: "Duncan 'O Maré-Brava'",
                info: { idade: 25, genero: "Masculino", casa: "Casa Manderly", pontos_destino: 2 },
                biografia: "Um guerreiro manderly que patrulha as profundezas da Faca Branca. Suas escamas verde-oliva o tornam quase invisível sob as águas turvas.",
                habilidades: {
                    luta: { base: 5, especialidades: { lancas: 5 } },
                    atletismo: { base: 5, especialidades: { nadar: 5 } },
                    furtividade: { base: 4, especialidades: { esgueirar_se: 4 } },
                    agilidade: { base: 4 }
                }
            }
        ]
    };

    console.log("Iniciando Criação da Casa Manderly (V3)...");

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

    ui.notifications.info("Casa Manderly (Tritões) V3 inicializada com sucesso!");
}

initializeManderlyAncient();
