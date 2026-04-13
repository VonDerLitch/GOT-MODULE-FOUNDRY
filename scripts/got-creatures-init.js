/**
 * GoT Creatures Initialization - Fantastic Beasts & Sothoryos Creatures
 * Creates high-level NPC actors with "upgraded" stats for the GoT module.
 */

async function initializeGotCreatures() {
    const eraName = "Criaturas de Gelo e Fogo";
    const eraColor = "#4a2c2a"; // Bark/Beast Brown

    const creatureData = [
        {
            name: "Grande Quelônio (Tartaruga do Roine)",
            biografia: "Conhecidos como 'O Velho do Rio', essas tartarugas gigantes são sagradas para os Roinares. Possuem carapaças impenetráveis e força suficiente para virar galés.",
            habilidades: {
                atletismo: { base: 6, especialidades: { nadar: 5, forca: 4 } },
                resistencia: { base: 7, especialidades: { vigor: 5, resiliencia: 4 } },
                luta: { base: 4, especialidades: { mordida: 3 } },
                percepcao: { base: 4, especialidades: { notar: 2 } },
                vontade: { base: 5, especialidades: { coragem: 4 } }
            },
            info: { idade: 200, genero: "N/A", casa: "Roine", pontos_destino: 0 },
            img: "icons/creatures/reptiles/turtle-giant-brown.webp"
        },
        {
            name: "Esfinge de Valíria",
            biografia: "Raras e místicas, as esfinges valirianas possuem o rosto de um humano, o corpo de um leão e as asas de uma águia. São guardiãs de enigmas e do conhecimento antigo.",
            habilidades: {
                astucia: { base: 6, especialidades: { logica: 5, memoria: 4 } },
                percepcao: { base: 6, especialidades: { empatia: 4, notar: 4 } },
                vontade: { base: 6, especialidades: { dedicacao: 5 } },
                luta: { base: 5, especialidades: { garras: 4 } },
                conhecimento: { base: 5, especialidades: { lendas: 6 } },
                agilidade: { base: 4, especialidades: { voo: 3 } }
            },
            info: { idade: 100, genero: "Feminino", casa: "Valíria", pontos_destino: 1 },
            img: "icons/creatures/magical/sphinx-stone-gold.webp"
        },
        {
            name: "Gato-das-sombras (Shadowcat)",
            biografia: "Grandes felinos negros com listras cinzas que habitam as montanhas. São capazes de sentir o cheiro de sangue a quilômetros e atacam silenciosamente.",
            habilidades: {
                agilidade: { base: 5, especialidades: { rapidez: 4, esquiva: 3 } },
                furtividade: { base: 6, especialidades: { espreitar: 5 } },
                percepcao: { base: 5, especialidades: { notar: 4, visao_noturna: 5 } },
                luta: { base: 5, especialidades: { garras: 4, mordida: 3 } },
                atletismo: { base: 4, especialidades: { saltar: 4 } }
            },
            info: { idade: 8, genero: "N/A", casa: "Selvagem", pontos_destino: 0 },
            img: "icons/creatures/mammals/panther-black.webp"
        },
        {
            name: "Wyvern (Arrebatador de Sothoryos)",
            biografia: "Os primos menores e mais ferozes dos dragões. Embora não cuspam fogo, seus bicos e garras são letais e sua agressividade é inigualável no Inferno Verde.",
            habilidades: {
                agilidade: { base: 6, especialidades: { rapidez: 5, voo: 6 } },
                atletismo: { base: 5, especialidades: { forca: 3 } },
                luta: { base: 6, especialidades: { garras: 4, mordida: 4 } },
                percepcao: { base: 5, especialidades: { notar: 4 } },
                resistencia: { base: 4, especialidades: { vigor: 3 } }
            },
            info: { idade: 15, genero: "N/A", casa: "Sothoryos", pontos_destino: 0 },
            img: "icons/creatures/reptiles/wyvern-flying-green.webp"
        },
        {
            name: "Macaco Branco Gigante",
            biografia: "Brutos imensos que habitam as profundezas de Sothoryos. São conhecidos por sua força hercúlea e por defenderem seus territórios com violência extrema.",
            habilidades: {
                atletismo: { base: 7, especialidades: { forca: 6, escalar: 5 } },
                resistencia: { base: 6, especialidades: { vigor: 5 } },
                luta: { base: 5, especialidades: { esmagar: 4 } },
                percepcao: { base: 4, especialidades: { notar: 2 } },
                vontade: { base: 5, especialidades: { coragem: 5 } }
            },
            info: { idade: 30, genero: "N/A", casa: "Sothoryos", pontos_destino: 0 },
            img: "icons/creatures/mammals/gorilla-white.webp"
        },
        {
            name: "Basilisco Sothoryano",
            biografia: "Grandes répteis encontrados nas selvas do sul. Sua pele é dura como couro e sua mordida é infundida com venenos que paralisam e matam em minutos.",
            habilidades: {
                resistencia: { base: 6, especialidades: { resiliencia: 5, vigor: 4 } },
                luta: { base: 5, especialidades: { mordida: 5 } },
                atletismo: { base: 4, especialidades: { forca: 3 } },
                furtividade: { base: 4, especialidades: { camuflagem: 4 } },
                percepcao: { base: 3, especialidades: { notar: 2 } }
            },
            info: { idade: 12, genero: "N/A", casa: "Sothoryos", pontos_destino: 0 },
            img: "icons/creatures/reptiles/basilisk-green.webp"
        },
        {
            name: "Morcego-Vampiro Gigante",
            biografia: "Predadores aéreos de Sothoryos que caçam à noite. Suas asas produzem pouco som e eles conseguem drenar o sangue de uma presa em pouco tempo.",
            habilidades: {
                agilidade: { base: 5, especialidades: { rapidez: 5, esquiva: 4 } },
                percepcao: { base: 6, especialidades: { ecoar: 6, notar: 4 } },
                furtividade: { base: 5, especialidades: { espreitar: 4 } },
                luta: { base: 4, especialidades: { mordida: 4 } }
            },
            info: { idade: 10, genero: "N/A", casa: "Sothoryos", pontos_destino: 0 },
            img: "icons/creatures/mammals/bat-giant-brown.webp"
        }
    ];

    console.log("GOT | Iniciando Criação de Criaturas Fantásticas...");

    // 1. Create Main Folder
    let mainFolder = game.folders.find(f => f.name === eraName && f.type === "Actor");
    if (!mainFolder) mainFolder = await Folder.create({ name: eraName, type: "Actor", color: eraColor });

    // 2. Create Creatures
    for (const creature of creatureData) {
        let existing = game.actors.find(a => a.name === creature.name && a.folder === mainFolder.id);
        if (existing) {
            console.log(`GOT | Criatura já existe: ${creature.name}`);
            continue;
        }

        await Actor.create({
            name: creature.name,
            type: "character", // Using character type for full stats
            folder: mainFolder.id,
            img: creature.img,
            system: {
                info: creature.info,
                biografia: creature.biografia,
                habilidades: creature.habilidades,
                tipo_ficha: "character",
                combate_intriga: {
                    esforco_ativo: false,
                    esforco_max: 3
                }
            }
        });
        console.log(`GOT | Criado: ${creature.name} na pasta ${eraName}`);
    }

    ui.notifications.info(`Pasta "${eraName}" populada com ${creatureData.length} criaturas lendárias!`);
}

// Execute on ready
Hooks.once('ready', async function () {
    if (!game.user.isGM) return;
    
    // Minimal delay to ensure folders are ready
    setTimeout(() => {
        initializeGotCreatures();
    }, 1000);
});
