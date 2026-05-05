export const COLORS = {
  primary: '#1B4F72', // Azul corporativo para encabezados
  accent: '#E67E22',  // Naranja vibrante para botones de acción
  background: '#FDFEFE',
  cardYellow: '#FEF9E7', // Amarillento suave para tarjetas
  borderBlue: '#AED6F1', // Borde azul fino
  success: '#28B463', // Verde
  warning: '#F39C12', // Naranja/Amarillo (En proceso)
  danger: '#CB4335',  // Rojo (Pendientes)
  text: '#2C3E50',
  textLight: '#7F8C8D',
  white: '#FFFFFF',
  shadow: '#000000',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  internal: 20, // Padding interno robusto
};

export const SIZES = {
  radius: 30, // Bordes redondeados 30
  icon: 24,
  iconLarge: 32,
};

export const SHADOWS = {
  soft: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
};

export const THEME = {
  colors: COLORS,
  spacing: SPACING,
  sizes: SIZES,
  shadows: SHADOWS,
};
