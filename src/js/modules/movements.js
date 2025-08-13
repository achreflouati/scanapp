export class MovementManager {
    constructor(database) {
        this.db = database;
    }

    async addMovement(movement) {
        const db = await this.db.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['movements'], 'readwrite');
            const store = transaction.objectStore('movements');
            const request = store.add({
                ...movement,
                date: new Date()
            });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getMovements(productId = null, startDate = null, endDate = null) {
        const db = await this.db.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['movements'], 'readonly');
            const store = transaction.objectStore('movements');
            const request = store.getAll();

            request.onsuccess = () => {
                let movements = request.result;
                
                if (productId) {
                    movements = movements.filter(m => m.productId === productId);
                }
                if (startDate) {
                    movements = movements.filter(m => new Date(m.date) >= startDate);
                }
                if (endDate) {
                    movements = movements.filter(m => new Date(m.date) <= endDate);
                }

                resolve(movements);
            };
            request.onerror = () => reject(request.error);
        });
    }
}
