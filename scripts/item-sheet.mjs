/**
 * Extend the base ItemSheet to implement the GoT Item Sheet.
 * @extends {ItemSheet}
 */
class GOTItemSheet extends ItemSheet {

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["got", "sheet", "item"],
            template: "modules/got-character-sheet/templates/item-sheet.hbs",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
        });
    }

    /** @override */
    async getData() {
        const context = await super.getData();
        const itemData = context.item;
        context.system = itemData.system;
        context.config = CONFIG.GOT;

        // Structured data for V12 selectOptions helper
        context.itemTypes = {
            "qualidade": "Qualidade/Benefício",
            "defeito": "Defeito/Desvantagem",
            "equipamento": "Equipamento",
            "arma": "Arma",
            "armadura": "Armadura",
            "escudo": "Escudo",
            "montaria": "Montaria/Cavalo"
        };

        return context;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
    }
}

// Register the Item Sheet
Hooks.once('init', async function () {
    Items.registerSheet("worldbuilding", GOTItemSheet, {
        makeDefault: true,
        label: "GOT.ItemSheetName"
    });
});
