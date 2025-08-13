export class ArticleManager {
    constructor(database) {
        this.db = database;
    }

    async createArticle(articleData) {
        // Validation des données
        this.validateArticleData(articleData);

        // Vérification si la référence existe déjà
        const exists = await this.checkReferenceExists(articleData.reference);
        if (exists) {
            throw new Error('Cette référence existe déjà');
        }

        // Création de l'article
        const article = {
            ...articleData,
            stockActuel: 0,
            statut: 'actif',
            dateCreation: new Date(),
            derniereModification: new Date()
        };

        return this.db.addArticle(article);
    }

    validateArticleData(data) {
        const required = ['reference', 'designation', 'famille', 'emplacement'];
        for (const field of required) {
            if (!data[field]) {
                throw new Error(`Le champ ${field} est obligatoire`);
            }
        }

        if (data.stockMin && typeof data.stockMin !== 'number') {
            throw new Error('Le stock minimum doit être un nombre');
        }

        if (data.stockMax && typeof data.stockMax !== 'number') {
            throw new Error('Le stock maximum doit être un nombre');
        }

        if (data.prixAchat && typeof data.prixAchat !== 'number') {
            throw new Error('Le prix d\'achat doit être un nombre');
        }
    }

    async checkReferenceExists(reference) {
        const articles = await this.db.getAll('articles', 'reference', reference);
        return articles.length > 0;
    }

    async searchArticles(query) {
        const articles = await this.db.getAll('articles');
        
        return articles.filter(article => {
            const searchString = query.toLowerCase();
            return (
                article.reference.toLowerCase().includes(searchString) ||
                article.designation.toLowerCase().includes(searchString) ||
                article.barcode?.toLowerCase().includes(searchString) ||
                article.famille.toLowerCase().includes(searchString)
            );
        });
    }

    async getArticlesByLocation(location) {
        return this.db.getAll('articles', 'emplacement', location);
    }

    async updateStock(articleId, newQuantity, type, motif) {
        const article = await this.db.get('articles', articleId);
        if (!article) {
            throw new Error('Article non trouvé');
        }

        const mouvement = {
            articleId,
            type,
            quantite: Math.abs(newQuantity),
            motif,
            utilisateur: 'system' // À remplacer par l'utilisateur connecté
        };

        return this.db.addMouvement(mouvement);
    }

    async getStockHistory(articleId, startDate = null, endDate = null) {
        const mouvements = await this.db.getAll('mouvements', 'articleId', articleId);
        
        return mouvements
            .filter(mvt => {
                if (startDate && new Date(mvt.date) < startDate) return false;
                if (endDate && new Date(mvt.date) > endDate) return false;
                return true;
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
}
