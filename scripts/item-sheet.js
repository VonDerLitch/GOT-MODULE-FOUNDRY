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

        // Build specialty labels map for modifier dropdowns
        // The defaultData has {key: 0} but we need {key: "Label"} for selectOptions
        if (CONFIG.GOT?.defaultData?.habilidades) {
            const specLabels = {};
            for (const [habKey, habData] of Object.entries(CONFIG.GOT.defaultData.habilidades)) {
                if (habData.especialidades) {
                    const labeled = {};
                    for (const specKey of Object.keys(habData.especialidades)) {
                        // Convert snake_case to Title Case
                        labeled[specKey] = specKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    }
                    specLabels[habKey] = { especialidades: labeled };
                }
            }
            context.specialtyLabels = specLabels;
        }

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

        html.find('.add-modifier').click(async ev => {
            let modifiers = this.item.system.modificadores;
            // Ensure we have a mutable array (Foundry sometimes saves arrays as objects)
            if (!modifiers || typeof modifiers !== 'object') modifiers = [];
            else modifiers = Object.values(modifiers);

            modifiers.push({ alvo: "", especialidade: "", valor: 0 });
            await this.item.update({ "system.modificadores": modifiers });
        });

        html.find('.delete-modifier').click(async ev => {
            const index = ev.currentTarget.closest('.modifier-row').dataset.index;
            let modifiers = this.item.system.modificadores;
            if (!modifiers || typeof modifiers !== 'object') return;
            else modifiers = Object.values(modifiers);

            modifiers.splice(index, 1);
            await this.item.update({ "system.modificadores": modifiers });
        });
    }
}

// Register the Item Sheet
Hooks.once('init', async function () {
    Items.registerSheet("worldbuilding", GOTItemSheet, {
        makeDefault: true,
        label: "GOT.ItemSheetName"
    });
});
