/**
 * Standalone Application for the Large Scale Family Tree
 */
console.log("GOT | family-tree-app.js LOADED");
class GOTFamilyTree extends Application {
    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;
        this.depth = options.depth || 3; // Níveis de profundidade (Avós, Bisavós...)
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "got-family-tree",
            title: "Árvore da Casa",
            template: "modules/got-character-sheet/templates/family-tree-app.hbs",
            width: 1000,
            height: 800,
            resizable: true,
            dragDrop: [{ dragSelector: ".tree-node", dropSelector: null }],
            closeOnSubmit: false,
            submitOnChange: false,
            popOut: true,
            minimizable: true
        });
    }

    /** @override */
    async getData(options) {
        const data = await super.getData(options);
        data.generations = await this._buildGenerations(this.actor);
        // Add House Name with Fallback
        const casa = this.actor.system.info?.casa;
        data.houseName = casa ? `Casa ${casa}` : "Casa Desconhecida";
        return data;
    }

    async _buildGenerations(actor) {
        if (!actor) return null;

        const resolve = async (id) => {
            if (!id) return null;
            return game.actors.get(id);
        };

        const resolveList = async (ids) => {
            if (!ids || !ids.length) return [];
            return await Promise.all(ids.map(id => resolve(id))).then(list => list.filter(a => a));
        };

        const l = actor.system.linhagem || {};

        // 1. Direct Relations
        const pai = await resolve(l.pai);
        const mae = await resolve(l.mae);
        const conjuge = await resolve(l.conjuge);
        const irmaos = await resolveList(l.irmaos);
        const filhos = await resolveList(l.filhos);

        // 2. Grandparents (Generation -2)
        let avosPaternos = [];
        let unclesPaternos = [];
        if (pai) {
            const pl = pai.system.linhagem || {};
            avosPaternos = [await resolve(pl.pai), await resolve(pl.mae)].filter(a => a);
            unclesPaternos = await resolveList(pl.irmaos);
        }

        let avosMaternos = [];
        let unclesMaternos = [];
        if (mae) {
            const ml = mae.system.linhagem || {};
            avosMaternos = [await resolve(ml.pai), await resolve(ml.mae)].filter(a => a);
            unclesMaternos = await resolveList(ml.irmaos);
        }

        // 3. Grandchildren (Generation +2)
        // Group grandchildren by child parent
        const netosGrouped = [];
        if (filhos.length > 0) {
            for (const filho of filhos) {
                const fl = filho.system.linhagem || {};
                const netos = await resolveList(fl.filhos);
                if (netos.length > 0) {
                    netosGrouped.push({
                        parent: filho,
                        children: netos
                    });
                }
            }
        }

        // Helper to format actor data for template
        const fmt = (a, relation = "") => {
            if (!a) return null;
            return { id: a.id, name: a.name, img: a.img, relation: relation };
        };
        const fmtList = (list, relation) => list.map(a => fmt(a, relation));

        const result = {
            gen_minus_2: {
                paternal: fmtList(avosPaternos, "Avô/Avó (P)"),
                maternal: fmtList(avosMaternos, "Avô/Avó (M)")
            },
            gen_minus_1: {
                paternal_uncles: fmtList(unclesPaternos, "Tio(a) (P)"),
                father: fmt(pai, "Pai"),
                mother: fmt(mae, "Mãe"),
                maternal_uncles: fmtList(unclesMaternos, "Tio(a) (M)")
            },
            gen_0: {
                siblings: fmtList(irmaos, "Irmão/Irmã"),
                self: fmt(actor, "Eu"),
                spouse: fmt(conjuge, "Cônjuge")
            },
            gen_plus_1: fmtList(filhos, "Filho(a)"),
            gen_plus_2: netosGrouped.map(g => ({
                parent: fmt(g.parent, "Filho(a)"),
                grandkids: fmtList(g.children, "Neto(a)")
            }))
        };

        console.log("GOT | Family Tree Generations:", result);
        return result;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Zoom e Pan (Simplificado para o MVP)
        html.find('.tree-canvas').on('wheel', ev => {
            // Implementação futura de zoom
        });

        // Open Character Sheet
        html.find('.btn-open-sheet').click(async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const card = $(ev.currentTarget).closest('.tree-card');
            const actorId = card.data('id');
            const actor = game.actors.get(actorId);
            if (actor) {
                actor.sheet.render(true);
            }
        });

        // Focus Tree on this character
        html.find('.btn-focus-tree').click(async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const card = $(ev.currentTarget).closest('.tree-card');
            const actorId = card.data('id');
            const actor = game.actors.get(actorId);
            if (actor) {
                // Update current instance and re-render
                this.actor = actor;
                this.render(true);
            }
        });
    }
}

// Expose to global scope for got-sheet.js
window.GOTFamilyTree = GOTFamilyTree;
