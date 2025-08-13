import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';

export class Scanner {
    constructor() {
        this.isNative = Capacitor.isNativePlatform();
    }

    async initScanner() {
        if (this.isNative) {
            // Vérifier les permissions de la caméra
            const permission = await Camera.checkPermissions();
            if (permission.camera !== 'granted') {
                await Camera.requestPermissions();
            }
        } else {
            // Initialiser QuaggaJS pour le web
            // À implémenter
        }
    }

    async scan() {
        if (this.isNative) {
            // Utiliser l'API Capacitor Camera
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: 'base64'
            });
            return image;
        } else {
            // Utiliser QuaggaJS pour le web
            // À implémenter
            return null;
        }
    }
}
