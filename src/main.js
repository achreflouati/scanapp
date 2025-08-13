import './style.css';
import './modal.css';
import { Database } from './js/core/database.js';
import { Scanner } from './js/core/scanner.js';
import { ArticleManager } from './js/modules/article-manager.js';
import { InventaireManager } from './js/modules/inventaire-manager.js';
import { UIManager } from './js/core/ui-manager.js';
import { ModalManager } from './js/core/modal-manager.js';

// Initialisation des managers
const database = new Database();
const scanner = new Scanner();
const articleManager = new ArticleManager(database);
const inventaireManager = new InventaireManager(database);
const modalManager = new ModalManager();

// Initialisation de l'application
async function initApp() {
    try {
        await database.init();
        await scanner.initScanner();
        modalManager.init(scanner, database);
        
        console.log('Application initialisée avec succès');
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        alert('Erreur lors du démarrage de l\'application');
    }
}

// Lancement de l'initialisation au chargement
document.addEventListener('DOMContentLoaded', initApp);
