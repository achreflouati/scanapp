export class UIManager {
    constructor(database, articleManager, inventaireManager) {
        this.db = database;
        this.articleManager = articleManager;
        this.inventaireManager = inventaireManager;
        this.currentInventaire = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Entrées
        document.getElementById('entryBtn').addEventListener('click', () => this.openModal('entry'));
        document.getElementById('entryForm').addEventListener('submit', (e) => this.handleEntry(e));
        
        // Sorties
        document.getElementById('exitBtn').addEventListener('click', () => this.openModal('exit'));
        document.getElementById('exitForm').addEventListener('submit', (e) => this.handleExit(e));
        
        // Inventaire
        document.getElementById('inventoryBtn').addEventListener('click', () => this.openModal('inventory'));
        document.getElementById('startInventory').addEventListener('click', () => this.startNewInventory());
        document.getElementById('continueInventory').addEventListener('click', () => this.continueInventory());
        
        // Consultation
        document.getElementById('viewBtn').addEventListener('click', () => this.openModal('view'));
        document.getElementById('searchArticle').addEventListener('input', (e) => this.handleSearch(e));
        
        // Export
        document.getElementById('exportBtn').addEventListener('click', () => this.openModal('export'));
        document.getElementById('exportType').addEventListener('change', (e) => this.toggleDateRange(e));
        
        // Fermeture des modales
        document.querySelectorAll('.modal-close, .modal-overlay .cancel').forEach(button => {
            button.addEventListener('click', () => this.closeModal());
        });

        // Scanner
        document.querySelectorAll('.scan-button').forEach(button => {
            button.addEventListener('click', (e) => this.handleScan(e));
        });
    }

    async handleScan(e) {
        try {
            const result = await this.scanner.scan();
            if (result) {
                const targetId = e.target.dataset.target;
                document.getElementById(targetId).value = result;
                await this.loadArticleDetails(result, targetId);
            }
        } catch (error) {
            console.error('Erreur de scan:', error);
            alert('Erreur lors du scan. Veuillez réessayer.');
        }
    }

    async loadArticleDetails(reference, sourceId) {
        try {
            const article = await this.articleManager.searchArticles(reference);
            if (article && article.length > 0) {
                const details = article[0];
                
                // Remplir les champs selon le contexte
                if (sourceId.startsWith('entry')) {
                    document.getElementById('entryDesignation').value = details.designation;
                    document.getElementById('entryLocation').value = details.emplacement;
                } else if (sourceId.startsWith('exit')) {
                    document.getElementById('exitDesignation').value = details.designation;
                    document.getElementById('exitCurrentStock').value = details.stockActuel;
                    // Limiter la quantité de sortie au stock disponible
                    document.getElementById('exitQuantity').max = details.stockActuel;
                } else if (sourceId.startsWith('inventory')) {
                    document.getElementById('inventoryDesignation').value = details.designation;
                    document.getElementById('inventoryTheoretical').value = details.stockActuel;
                    document.querySelector('.inventory-details').classList.remove('hidden');
                }
            } else {
                if (confirm('Article non trouvé. Voulez-vous le créer ?')) {
                    this.openModal('createArticle');
                }
            }
        } catch (error) {
            console.error('Erreur lors du chargement des détails:', error);
            alert('Erreur lors du chargement des détails de l\'article');
        }
    }

    async handleEntry(e) {
        e.preventDefault();
        try {
            const data = {
                reference: document.getElementById('entryReference').value,
                quantity: parseInt(document.getElementById('entryQuantity').value),
                supplier: document.getElementById('entrySupplier').value,
                location: document.getElementById('entryLocation').value,
                note: document.getElementById('entryNote').value
            };

            await this.articleManager.updateStock(data.reference, data.quantity, 'entree', data.note);
            this.closeModal();
            alert('Entrée enregistrée avec succès');
        } catch (error) {
            console.error('Erreur lors de l\'entrée:', error);
            alert(error.message);
        }
    }

    async handleExit(e) {
        e.preventDefault();
        try {
            const data = {
                reference: document.getElementById('exitReference').value,
                quantity: parseInt(document.getElementById('exitQuantity').value),
                reason: document.getElementById('exitReason').value,
                note: document.getElementById('exitNote').value
            };

            await this.articleManager.updateStock(data.reference, data.quantity, 'sortie', data.reason);
            this.closeModal();
            alert('Sortie enregistrée avec succès');
        } catch (error) {
            console.error('Erreur lors de la sortie:', error);
            alert(error.message);
        }
    }

    async startNewInventory() {
        try {
            this.currentInventaire = await this.inventaireManager.demarrerInventaire();
            this.showInventoryInterface();
        } catch (error) {
            console.error('Erreur lors du démarrage de l\'inventaire:', error);
            alert(error.message);
        }
    }

    async continueInventory() {
        const inventaires = await this.db.getAll('inventaires', 'status', 'en_cours');
        if (inventaires.length > 0) {
            this.currentInventaire = inventaires[0];
            this.showInventoryInterface();
        } else {
            alert('Aucun inventaire en cours');
        }
    }

    showInventoryInterface() {
        document.querySelector('.inventory-actions').classList.add('hidden');
        document.querySelector('.inventory-scan').classList.remove('hidden');
        document.querySelector('.inventory-progress').classList.remove('hidden');
        this.updateInventoryProgress();
    }

    async updateInventoryProgress() {
        if (!this.currentInventaire) return;

        const stats = await this.inventaireManager.getEtatInventaire(this.currentInventaire.id);
        const progressBar = document.querySelector('.progress');
        const progressText = document.querySelector('.progress-text');

        progressBar.style.width = `${stats.progression}%`;
        progressText.textContent = `${stats.progression}% (${stats.faits}/${stats.total})`;

        // Afficher le bouton de validation si tout est fait
        const validateButton = document.querySelector('#inventoryModal .confirm');
        validateButton.classList.toggle('hidden', stats.reste > 0);
    }

    async handleSearch(e) {
        const query = e.target.value;
        const articles = await this.articleManager.searchArticles(query);
        this.displaySearchResults(articles);
    }

    displaySearchResults(articles) {
        const container = document.querySelector('.articles-list');
        container.innerHTML = '';

        articles.forEach(article => {
            const element = document.createElement('div');
            element.className = 'article-item';
            element.innerHTML = `
                <div class="article-header">
                    <span class="reference">${article.reference}</span>
                    <span class="stock ${article.stockActuel <= article.stockMin ? 'warning' : ''}">${article.stockActuel}</span>
                </div>
                <div class="article-body">
                    <span class="designation">${article.designation}</span>
                    <span class="location">${article.emplacement}</span>
                </div>
            `;
            element.addEventListener('click', () => this.showArticleDetails(article));
            container.appendChild(element);
        });
    }

    showArticleDetails(article) {
        const details = document.querySelector('.article-details');
        details.classList.remove('hidden');
        details.innerHTML = `
            <h3>${article.designation}</h3>
            <div class="details-grid">
                <div class="detail-item">
                    <label>Référence</label>
                    <span>${article.reference}</span>
                </div>
                <div class="detail-item">
                    <label>Stock actuel</label>
                    <span>${article.stockActuel}</span>
                </div>
                <div class="detail-item">
                    <label>Emplacement</label>
                    <span>${article.emplacement}</span>
                </div>
                <!-- Plus de détails... -->
            </div>
            <div class="movements-history">
                <h4>Derniers mouvements</h4>
                <!-- Liste des mouvements à charger -->
            </div>
        `;
    }

    openModal(type) {
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.classList.remove('active'));
        const modal = document.getElementById(`${type}Modal`);
        if (modal) {
            modal.classList.add('active');
            // Réinitialisation des formulaires
            const form = modal.querySelector('form');
            if (form) form.reset();
        }
    }

    closeModal() {
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.classList.remove('active'));
        this.currentInventaire = null;
    }

    toggleDateRange(e) {
        const dateRange = document.querySelector('.date-range');
        dateRange.classList.toggle('hidden', e.target.value === 'stock');
    }
}
