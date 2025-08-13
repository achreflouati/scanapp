export class ModalManager {
    constructor() {
        this.activeModal = null;
        this.scanner = null;
        this.database = null;
    }

    init(scanner, database) {
        this.scanner = scanner;
        this.database = database;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Boutons d'ouverture des modales
        document.getElementById('entryBtn').addEventListener('click', () => this.openModal('entry'));
        document.getElementById('exitBtn').addEventListener('click', () => this.openModal('exit'));
        document.getElementById('inventoryBtn').addEventListener('click', () => this.openModal('inventory'));
        document.getElementById('viewBtn').addEventListener('click', () => this.openModal('view'));

        // Fermeture des modales
        document.querySelectorAll('.modal-close, .modal-overlay .cancel').forEach(button => {
            button.addEventListener('click', () => this.closeActiveModal());
        });

        // Gestion du scan
        document.querySelectorAll('.scan-button').forEach(button => {
            button.addEventListener('click', async (e) => {
                const targetInput = document.getElementById(e.target.dataset.target);
                if (targetInput && this.scanner) {
                    try {
                        const result = await this.scanner.scan();
                        if (result) {
                            targetInput.value = result;
                            this.handleScanResult(result);
                        }
                    } catch (error) {
                        console.error('Erreur de scan:', error);
                        alert('Erreur lors du scan. Veuillez réessayer.');
                    }
                }
            });
        });

        // Soumission des formulaires
        document.getElementById('entryForm').addEventListener('submit', (e) => this.handleEntry(e));
        document.getElementById('exitForm').addEventListener('submit', (e) => this.handleExit(e));
    }

    openModal(type) {
        if (this.activeModal) {
            this.closeActiveModal();
        }

        const modalId = `${type}Modal`;
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            this.activeModal = modal;

            // Initialisation spécifique selon le type
            switch (type) {
                case 'inventory':
                    this.initInventoryView();
                    break;
                case 'view':
                    this.initProductView();
                    break;
            }
        }
    }

    closeActiveModal() {
        if (this.activeModal) {
            this.activeModal.classList.remove('active');
            this.activeModal = null;
        }
    }

    async handleScanResult(barcode) {
        try {
            // Recherche du produit dans la base
            const product = await this.database.getProductByBarcode(barcode);
            if (product) {
                this.fillProductInfo(product);
            } else {
                alert('Produit non trouvé. Voulez-vous le créer ?');
                // TODO: Implémenter la création de nouveau produit
            }
        } catch (error) {
            console.error('Erreur lors de la recherche du produit:', error);
        }
    }

    async handleEntry(e) {
        e.preventDefault();
        const articleData = {
            reference: document.getElementById('entryReference').value,
            designation: document.getElementById('entryDesignation').value,
            fournisseur: document.getElementById('entrySupplier').value,
            emplacement: document.getElementById('entryLocation').value
        };

        const quantity = parseInt(document.getElementById('entryQuantity').value);
        const note = document.getElementById('entryNote').value;

        try {
            // Ajouter ou mettre à jour l'article
            let articleId = await this.database.add('articles', articleData);

            // Ajouter le mouvement
            await this.database.add('mouvements', {
                articleId,
                type: 'entree',
                quantite: quantity,
                note: note,
                date: new Date()
            });

            this.closeActiveModal();
            alert('Entrée enregistrée avec succès');
        } catch (error) {
            console.error('Erreur lors de l\'entrée:', error);
            alert('Erreur lors de l\'enregistrement de l\'entrée');
        }
    }

    async handleExit(e) {
        e.preventDefault();
        const data = {
            barcode: document.getElementById('exitBarcode').value,
            quantity: parseInt(document.getElementById('exitQuantity').value),
            note: document.getElementById('exitNote').value
        };

        try {
            await this.database.addExit(data);
            this.closeActiveModal();
            alert('Sortie enregistrée avec succès');
        } catch (error) {
            console.error('Erreur lors de la sortie:', error);
            alert('Erreur lors de l\'enregistrement de la sortie');
        }
    }

    async initInventoryView() {
        try {
            const inventoryContent = document.querySelector('#inventoryModal .modal-body');
            if (!inventoryContent) return;
            
            inventoryContent.innerHTML = `
                <div class="inventory-container">
                    <div class="inventory-header">
                        <h3>Inventaire en cours</h3>
                        <button id="newInventoryBtn" class="primary-button">Nouveau</button>
                    </div>
                    <div id="inventoryList" class="inventory-list">
                        <p>Chargement de l'inventaire...</p>
                    </div>
                </div>
            `;
            
            // TODO: Charger l'inventaire actuel une fois la base de données prête
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de la vue inventaire:', error);
        }
    }

    async initProductView() {
        try {
            const productContent = document.querySelector('#viewModal .modal-body');
            if (!productContent) return;
            
            productContent.innerHTML = `
                <div class="product-container">
                    <div class="search-container">
                        <input type="text" id="productSearch" placeholder="Rechercher un produit...">
                        <button class="scan-button" data-target="productSearch">📷</button>
                    </div>
                    <div id="productList" class="product-list">
                        <p>Chargement des produits...</p>
                    </div>
                </div>
            `;
            
            // Ajouter l'écouteur d'événements pour la recherche
            const searchInput = document.getElementById('productSearch');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => this.handleProductSearch(e.target.value));
            }
            
            // TODO: Charger la liste initiale des produits une fois la base de données prête
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de la vue produits:', error);
        }
    }

    fillProductInfo(product) {
        // Remplir les champs avec les informations du produit scanné
        const activeForm = this.activeModal.querySelector('form');
        if (activeForm) {
            const fields = {
                'entryReference': product.reference,
                'entryDesignation': product.designation,
                'entryLocation': product.emplacement,
                'exitReference': product.reference,
                'exitDesignation': product.designation
            };
            
            for (const [id, value] of Object.entries(fields)) {
                const field = activeForm.querySelector(`#${id}`);
                if (field) field.value = value || '';
            }
        }
    }

    async handleProductSearch(query) {
        try {
            const productList = document.getElementById('productList');
            if (!productList) return;

            if (!query) {
                productList.innerHTML = '<p>Veuillez saisir un terme de recherche</p>';
                return;
            }

            productList.innerHTML = '<p>Recherche en cours...</p>';
            
            // TODO: Implémenter la recherche réelle une fois la base de données prête
            // Pour l'instant, on simule un délai
            await new Promise(resolve => setTimeout(resolve, 500));
            
            productList.innerHTML = '<p>Aucun résultat trouvé</p>';
        } catch (error) {
            console.error('Erreur lors de la recherche:', error);
            const productList = document.getElementById('productList');
            if (productList) {
                productList.innerHTML = '<p>Erreur lors de la recherche</p>';
            }
        }
    }
}
