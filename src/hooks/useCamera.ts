/**
 * Hook de cámara/galería.
 *
 * Expone dos métodos de captura:
 *  - takePhoto()    → abre la cámara del dispositivo.
 *  - pickFromGallery() → abre el selector de la galería.
 *
 * Devuelve el objeto FotoSeleccionada listo para pasar a UploadService.
 */
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import type { FotoSeleccionada } from '../types';

interface UseCameraReturn {
  foto: FotoSeleccionada | null;
  hasCameraPermission: boolean;
  hasGalleryPermission: boolean;
  takePhoto: () => Promise<FotoSeleccionada | null>;
  pickFromGallery: () => Promise<FotoSeleccionada | null>;
  clearFoto: () => void;
}

const IMAGE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.8,   // 80% calidad — equilibrio entre nitidez y tamaño
};

function buildFotoFromResult(
  result: ImagePicker.ImagePickerSuccessResult,
): FotoSeleccionada | null {
  const asset = result.assets?.[0];
  if (!asset) return null;

  const extension = asset.uri.split('.').pop() ?? 'jpg';

  return {
    uri: asset.uri,
    type: asset.mimeType ?? `image/${extension}`,
    name: asset.fileName ?? `reporte_${Date.now()}.${extension}`,
  };
}

export function useCamera(): UseCameraReturn {
  const [foto, setFoto] = useState<FotoSeleccionada | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [hasGalleryPermission, setHasGalleryPermission] = useState(false);

  useEffect(() => {
    Promise.all([
      ImagePicker.requestCameraPermissionsAsync(),
      ImagePicker.requestMediaLibraryPermissionsAsync(),
    ]).then(([camera, gallery]) => {
      setHasCameraPermission(camera.status === 'granted');
      setHasGalleryPermission(gallery.status === 'granted');
    });
  }, []);

  /**
   * Abre la cámara y devuelve la foto capturada.
   */
  const takePhoto = useCallback(async (): Promise<FotoSeleccionada | null> => {
    if (!hasCameraPermission) {
      throw new Error('Permiso de cámara no concedido');
    }

    const result = await ImagePicker.launchCameraAsync(IMAGE_OPTIONS);

    if (result.canceled) return null;

    const nuevaFoto = buildFotoFromResult(result);
    setFoto(nuevaFoto);
    return nuevaFoto;
  }, [hasCameraPermission]);

  /**
   * Abre la galería y devuelve la imagen seleccionada.
   */
  const pickFromGallery = useCallback(async (): Promise<FotoSeleccionada | null> => {
    if (!hasGalleryPermission) {
      throw new Error('Permiso de galería no concedido');
    }

    const result = await ImagePicker.launchImageLibraryAsync(IMAGE_OPTIONS);

    if (result.canceled) return null;

    const nuevaFoto = buildFotoFromResult(result);
    setFoto(nuevaFoto);
    return nuevaFoto;
  }, [hasGalleryPermission]);

  const clearFoto = useCallback(() => setFoto(null), []);

  return {
    foto,
    hasCameraPermission,
    hasGalleryPermission,
    takePhoto,
    pickFromGallery,
    clearFoto,
  };
}
