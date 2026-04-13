/**
 * GoT House Stark & Northern Vassals Initializer (Era dos Heróis)
 * Includes Casa Stark, Umber (Giants), Mormont, and Bolton.
 */

async function initializeStarkAncient() {
    const eraSuffix = " [Antigo]";
    const eraName = "Reis dos Primeiros Homens" + eraSuffix;
    const eraColor = "#228b22";

    const northContent = {
        houses: [
            {
                name: "Casa Stark",
                history: `<h2>Casa Stark: Os Reis do Inverno</h2>
                    <p><strong>Sede:</strong> Winterfell</p>
                    <hr>
                    <p>Os Stark governam o Norte a partir de Winterfell há milênios, desde que **Brandon o Construtor** ergueu as primeiras pedras do castelo com a ajuda de gigantes e da magia dos Filhos da Floresta.</p>
                    <p><strong>Nesta Era (5.000 A.C.):</strong> Os Stark já consolidaram seu domínio sobre o Norte. Eles são conhecidos como Reis do Inverno, soberanos implacáveis que não toleram rebelião. Suas fileiras são compostas pelos guerreiros mais endurecidos de Westeros, e diz-se que gigantes marcham sob seu estandarte de lobo.</p>`,
                characters: [
                    { name: "Brandon o Construtor", bio: "O lendário fundador da Casa Stark, arquiteto de Winterfell e da Muralha. Diz-se que ele fala a língua dos gigantes e dos Filhos da Floresta." },
                    { name: "Theon Stark", bio: "Conhecido como o 'Lobo Faminto'. Um rei guerreiro magro e feroz que passou sua vida em guerra contra invasores, piratas e rebeldes bolton." }
                ]
            },
            {
                name: "Casa Umber",
                history: `<h2>Casa Umber: Os Guardiões da Última Lareira</h2>
                    <p>Vassalos leais de Winterfell, os Umber protegem as fronteiras mais ao norte contra as incursões dos selvagens e coisas piores que rastejam do inverno eterno.</p>
                    <p><strong>A Aliança dos Gigantes:</strong> Nesta era, os Umber são conhecidos por abrigar e liderar gigantes em combate. A força física desses seres colossais é a espinha dorsal de suas defesas.</p>`,
                characters: [
                    { name: "General 'Esmaga-Montanhas'", bio: "Um gigante colossal que serve como general de elite da Casa Umber. Seu rugido é capaz de desestabilizar cavalarias inteiras e seus golpes de tronco de árvore destroem qualquer escudo." },
                    { name: "Hothor Umber (Ancestral)", bio: "Um homem tão grande quanto um meio-gigante, conhecido por sua força bruta e lealdade cega ao Rei do Inverno." }
                ]
            },
            {
                name: "Casa Mormont",
                history: `<h2>Casa Mormont: Os Ursos da Ilha</h2>
                    <p>Situada na remota e perigosa Ilha dos Ursos, esta casa é composta por guerreiros e guerreiras de ferocidade inigualável. Devido às constantes ameaças de sequestradores de ferro e selvagens, até as mulheres Mormont aprendem a lutar desde o berço.</p>`,
                characters: [
                    { name: "Jorym Mormont", bio: "Um herói lendário que, segundo as histórias, derrotou um urso polar gigante com as próprias mãos antes de se tornar o senhor da ilha." }
                ]
            },
            {
                name: "Casa Bolton",
                history: `<h2>Casa Bolton: Os Reis Vermelhos</h2>
                    <p>Recentemente subjugados após séculos de rivalidade sangrenta contra os Stark. Embora agora prestem juramento a Winterfell, o Forte do Pavor ainda guarda segredos sombrios e práticas que fazem o resto do Norte tremer.</p>`,
                characters: [
                    { name: "Rogar o Caçador", bio: "Um Bolton implacável conhecido por suas táticas de guerrilha nas florestas e por sua perícia com lâminas de bronze." }
                ]
            }
        ]
    };

    // 1. Get or Create Era Folders
    let eraActorFolder = game.folders.find(f => f.name === eraName && f.type === "Actor");
    if (!eraActorFolder) eraActorFolder = await Folder.create({ name: eraName, type: "Actor", color: eraColor });

    let eraJournalFolder = game.folders.find(f => f.name === eraName && f.type === "JournalEntry");
    if (!eraJournalFolder) eraJournalFolder = await Folder.create({ name: eraName, type: "JournalEntry", color: eraColor });

    // 2. Process Houses
    for (const house of northContent.houses) {
        let houseActorFolder = game.folders.find(f => f.name === house.name && f.folder === eraActorFolder.id);
        if (!houseActorFolder) houseActorFolder = await Folder.create({ name: house.name, type: "Actor", folder: eraActorFolder.id });

        let houseJournalFolder = game.folders.find(f => f.name === house.name && f.folder === eraJournalFolder.id);
        if (!houseJournalFolder) houseJournalFolder = await Folder.create({ name: house.name, type: "JournalEntry", folder: eraJournalFolder.id });

        // Create Journal
        let journal = game.journal.find(j => j.name === house.name && j.folder === houseJournalFolder.id);
        if (!journal) {
            await JournalEntry.create({
                name: house.name,
                folder: houseJournalFolder.id,
                pages: [{ name: "História e Contexto", type: "text", text: { content: house.history, format: 1 } }]
            });
        }

        // Create Characters
        for (const char of house.characters) {
            let actor = game.actors.find(a => a.name === char.name && a.folder === houseActorFolder.id);
            if (!actor) {
                await Actor.create({
                    name: char.name,
                    type: "character",
                    folder: houseActorFolder.id,
                    "system.biografia": char.bio,
                    "system.tipo_ficha": "character"
                });
            }
        }
    }

    ui.notifications.info("Norte Dominado! Casa Stark e seus vassalos foram inicializados.");
}

initializeStarkAncient();
