/**
 * Gestionnaire de base de données IndexedDB
 */
export class Database {
    constructor() {
        this.dbName = 'scanappstock';
        this.dbVersion = 1;
        this.db = null;
    }

    /**
     * Initialise la base de données
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Articles store
                if (!db.objectStoreNames.contains('articles')) {
                    const articleStore = db.createObjectStore('articles', { keyPath: 'id', autoIncrement: true });
                    articleStore.createIndex('reference', 'reference', { unique: true });
                    articleStore.createIndex('barcode', 'barcode', { unique: true });
                    articleStore.createIndex('designation', 'designation', { unique: false });
                    articleStore.createIndex('famille', 'famille', { unique: false });
                    articleStore.createIndex('emplacement', 'emplacement', { unique: false });
                    articleStore.createIndex('fournisseur', 'fournisseur', { unique: false });
                    articleStore.createIndex('statut', 'statut', { unique: false });
                }

                // Mouvements store
                if (!db.objectStoreNames.contains('mouvements')) {
                    const mouvementStore = db.createObjectStore('mouvements', { keyPath: 'id', autoIncrement: true });
                    mouvementStore.createIndex('articleId', 'articleId', { unique: false });
                    mouvementStore.createIndex('type', 'type', { unique: false });
                    mouvementStore.createIndex('date', 'date', { unique: false });
                    mouvementStore.createIndex('utilisateur', 'utilisateur', { unique: false });
                    mouvementStore.createIndex('lot', 'lot', { unique: false });
                }

                // Inventaire store
                if (!db.objectStoreNames.contains('inventaires')) {
                    const inventaireStore = db.createObjectStore('inventaires', { keyPath: 'id', autoIncrement: true });
                    inventaireStore.createIndex('date', 'date', { unique: false });
                    inventaireStore.createIndex('status', 'status', { unique: false });
                    inventaireStore.createIndex('zone', 'zone', { unique: false });
                }

                // Alertes store
                if (!db.objectStoreNames.contains('alertes')) {
                    const alerteStore = db.createObjectStore('alertes', { keyPath: 'id', autoIncrement: true });
                    alerteStore.createIndex('type', 'type', { unique: false });
                    alerteStore.createIndex('status', 'status', { unique: false });
                    alerteStore.createIndex('date', 'date', { unique: false });
                }

                // Paramètres store
                if (!db.objectStoreNames.contains('parametres')) {
                    const paramStore = db.createObjectStore('parametres', { keyPath: 'id', autoIncrement: true });
                    paramStore.createIndex('category', 'category', { unique: false });
                }

                // Audit trail store
                if (!db.objectStoreNames.contains('audit')) {
                    const auditStore = db.createObjectStore('audit', { keyPath: 'id', autoIncrement: true });
                    auditStore.createIndex('date', 'date', { unique: false });
                    auditStore.createIndex('utilisateur', 'utilisateur', { unique: false });
                    auditStore.createIndex('action', 'action', { unique: false });
                }
            };
        });
    }

    // Méthodes génériques CRUD
    async add(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add({
                ...data,
                dateCreation: new Date(),
                derniereModification: new Date()
            });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName, indexName = null, query = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            let request;

            if (indexName && query) {
                const index = store.index(indexName);
                request = index.getAll(query);
            } else {
                request = store.getAll();
            }

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, id, data) {
        const existing = await this.get(storeName, id);
        if (!existing) throw new Error('Record not found');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put({
                ...existing,
                ...data,
                id,
                derniereModification: new Date()
            });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Méthodes spécifiques pour la gestion de stock
    async addArticle(article) {
        // Validation des données obligatoires
        if (!article.reference || !article.designation) {
            throw new Error('Reference et designation sont obligatoires');
        }

        // Ajout de l'article avec audit
        const id = await this.add('articles', article);
        await this.addAudit('article', 'creation', article);
        return id;
    }

    async addMouvement(mouvement) {
        // Validation du mouvement
        if (!mouvement.articleId || !mouvement.type || !mouvement.quantite) {
            throw new Error('ArticleId, type et quantite sont obligatoires');
        }

        // Récupération de l'article
        const article = await this.get('articles', mouvement.articleId);
        if (!article) throw new Error('Article non trouvé');

        // Calcul du nouveau stock
        const stockAvant = article.stockActuel || 0;
        let stockApres = stockAvant;

        if (mouvement.type === 'entree') {
            stockApres += mouvement.quantite;
        } else if (mouvement.type === 'sortie') {
            stockApres -= mouvement.quantite;
            if (stockApres < 0) throw new Error('Stock insuffisant');
        }

        // Mise à jour dans une transaction
        const transaction = this.db.transaction(['articles', 'mouvements', 'audit'], 'readwrite');
        
        try {
            // Mise à jour du stock
            await this.update('articles', article.id, { stockActuel: stockApres });

            // Enregistrement du mouvement
            const mouvementComplet = {
                ...mouvement,
                stockAvant,
                stockApres,
                date: new Date()
            };
            await this.add('mouvements', mouvementComplet);

            // Audit
            await this.addAudit('stock', 'mouvement', {
                article: article.reference,
                type: mouvement.type,
                quantite: mouvement.quantite
            });

            // Vérification des alertes
            await this.checkAlertes(article.id);

            return mouvementComplet;
        } catch (error) {
            transaction.abort();
            throw error;
        }
    }

    async addAudit(module, action, details) {
        return this.add('audit', {
            module,
            action,
            details,
            date: new Date(),
            utilisateur: 'system', // À remplacer par l'utilisateur connecté
            ip: window.location.hostname
        });
    }

    async checkAlertes(articleId) {
        const article = await this.get('articles', articleId);
        if (!article) return;

        // Alerte stock minimum
        if (article.stockActuel <= article.stockMin) {
            await this.add('alertes', {
                type: 'stock_min',
                articleId,
                message: `Stock minimum atteint pour ${article.reference}`,
                status: 'active',
                date: new Date()
            });
        }
    }
}
