/**
 * Servicio de subida de archivos.
 *
 * Estrategia:
 *  1. Toma el URI local de la foto (ej: file:///data/user/.../camera/photo.jpg).
 *  2. Construye un FormData con el archivo binario.
 *  3. Hace POST /upload/photo con Content-Type: multipart/form-data.
 *  4. El backend devuelve la URL pública { url: string }.
 *
 * NOTA BACKEND: Para activar este servicio debes agregar en NestJS:
 *   - npm install @nestjs/platform-express multer @types/multer
 *   - Un UploadController con @UseInterceptors(FileInterceptor('photo'))
 *   - Configura el destino (local o S3/Cloudinary) con MulterModule.
 */
import { API_CONFIG } from '../config/api.config';
import type { FotoSeleccionada } from '../types';
import apiClient from './api.client';

export interface UploadPhotoResponse {
  url: string;
}

export const UploadService = {
  /**
   * Sube una foto al servidor y devuelve su URL pública.
   *
   * @param foto - Objeto FotoSeleccionada obtenido desde useCamera/expo-image-picker.
   * @param onProgress - Callback opcional para mostrar progreso (0–100).
   */
  async uploadPhoto(
    foto: FotoSeleccionada,
    onProgress?: (percent: number) => void,
  ): Promise<string> {
    const formData = new FormData();

    // React Native acepta este formato especial de objeto en FormData
    formData.append('photo', {
      uri: foto.uri,
      type: foto.type,
      name: foto.name,
    } as unknown as Blob);

    const { data } = await apiClient.post<UploadPhotoResponse>(
      API_CONFIG.ENDPOINTS.UPLOAD.PHOTO,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            const percent = Math.round((event.loaded * 100) / event.total);
            onProgress(percent);
          }
        },
      },
    );

    return data.url;
  },
};
