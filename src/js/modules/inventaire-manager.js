export class InventaireManager {
    constructor(database) {
        this.db = database;
    }

    async demarrerInventaire(zone = null) {
        const inventaire = {
            date: new Date(),
            zone,
            status: 'en_cours',
            lignes: [],
            utilisateur: 'system' // À remplacer par l'utilisateur connecté
        };

        // Récupérer tous les articles de la zone
        let articles;
        if (zone) {
            articles = await this.db.getAll('articles', 'emplacement', zone);
        } else {
            articles = await this.db.getAll('articles');
        }

        // Créer les lignes d'inventaire
        inventaire.lignes = articles.map(article => ({
            articleId: article.id,
            reference: article.reference,
            designation: article.designation,
            stockTheorique: article.stockActuel,
            stockReel: null,
            ecart: null,
            status: 'à_faire'
        }));

        const inventaireId = await this.db.add('inventaires', inventaire);
        await this.db.addAudit('inventaire', 'demarrage', { id: inventaireId, zone });
        
        return inventaireId;
    }

    async saisirQuantite(inventaireId, articleId, quantiteReelle) {
        const inventaire = await this.db.get('inventaires', inventaireId);
        if (!inventaire) throw new Error('Inventaire non trouvé');

        const ligne = inventaire.lignes.find(l => l.articleId === articleId);
        if (!ligne) throw new Error('Article non trouvé dans l\'inventaire');

        ligne.stockReel = quantiteReelle;
        ligne.ecart = quantiteReelle - ligne.stockTheorique;
        ligne.status = 'fait';

        await this.db.update('inventaires', inventaireId, inventaire);
        await this.db.addAudit('inventaire', 'saisie', {
            inventaireId,
            articleId,
            stockReel: quantiteReelle,
            ecart: ligne.ecart
        });
    }

    async validerInventaire(inventaireId) {
        const inventaire = await this.db.get('inventaires', inventaireId);
        if (!inventaire) throw new Error('Inventaire non trouvé');

        // Vérifier que toutes les lignes sont saisies
        const lignesNonSaisies = inventaire.lignes.filter(l => l.status === 'à_faire');
        if (lignesNonSaisies.length > 0) {
            throw new Error('Toutes les lignes doivent être saisies avant validation');
        }

        // Mettre à jour le stock réel
        const transaction = this.db.db.transaction(['articles', 'mouvements', 'audit'], 'readwrite');
        
        try {
            for (const ligne of inventaire.lignes) {
                if (ligne.ecart !== 0) {
                    // Mise à jour du stock
                    await this.db.update('articles', ligne.articleId, {
                        stockActuel: ligne.stockReel
                    });

                    // Création d'un mouvement d'ajustement
                    await this.db.addMouvement({
                        articleId: ligne.articleId,
                        type: 'ajustement',
                        quantite: Math.abs(ligne.ecart),
                        motif: 'Ajustement inventaire',
                        inventaireId
                    });
                }
            }

            // Finaliser l'inventaire
            inventaire.status = 'terminé';
            inventaire.dateValidation = new Date();
            await this.db.update('inventaires', inventaireId, inventaire);

            await this.db.addAudit('inventaire', 'validation', {
                id: inventaireId,
                date: new Date()
            });

            return true;
        } catch (error) {
            transaction.abort();
            throw error;
        }
    }

    async getEtatInventaire(inventaireId) {
        const inventaire = await this.db.get('inventaires', inventaireId);
        if (!inventaire) throw new Error('Inventaire non trouvé');

        const total = inventaire.lignes.length;
        const faits = inventaire.lignes.filter(l => l.status === 'fait').length;
        const ecarts = inventaire.lignes.filter(l => l.ecart !== 0).length;

        return {
            total,
            faits,
            reste: total - faits,
            ecarts,
            progression: Math.round((faits / total) * 100)
        };
    }

    async exportInventaire(inventaireId, format = 'csv') {
        const inventaire = await this.db.get('inventaires', inventaireId);
        if (!inventaire) throw new Error('Inventaire non trouvé');

        if (format === 'csv') {
            return this.exportToCSV(inventaire);
        } else {
            throw new Error('Format non supporté');
        }
    }

    exportToCSV(inventaire) {
        const headers = ['Référence', 'Désignation', 'Stock Théorique', 'Stock Réel', 'Écart'];
        const rows = inventaire.lignes.map(ligne => [
            ligne.reference,
            ligne.designation,
            ligne.stockTheorique,
            ligne.stockReel,
            ligne.ecart
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        return csv;
    }
}
