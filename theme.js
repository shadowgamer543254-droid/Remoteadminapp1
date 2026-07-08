/**
 * Mparivahan E-Challan Theme
 *
 * Exact color tokens derived from the Government of India's
 * mParivahan / Parivahan Sewa digital identity:
 *
 *   Primary Blue   #1565C0   (trust, authority)
 *   Primary Dark   #0D47A1   (status bar, headers)
 *   Primary Light  #1976D2   (secondary elements)
 *   Saffron        #FF6F00   (highlights, India branding)
 *   Success Green  #2E7D32   (paid / verified)
 *   Error Red      #C62828   (pending / alerts)
 *   Background     #F5F5F5   (page wash)
 *   Card           #FFFFFF   (surfaces)
 *   Text Primary   #212121   (headings)
 *   Text Secondary #757575   (labels)
 */

import { createTheme } from '@mui/material/styles';

const mparivahanPalette = {
  primary: {
    main: '#1565C0',
    dark: '#0D47A1',
    light: '#42A5F5',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#FF6F00',
    dark: '#E65100',
    light: '#FFA040',
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#2E7D32',
    light: '#66BB6A',
    dark: '#1B5E20',
  },
  error: {
    main: '#C62828',
    light: '#EF5350',
    dark: '#B71C1C',
  },
  warning: {
    main: '#F9A825',
    light: '#FDD835',
    dark: '#F57F17',
  },
  info: {
    main: '#0277BD',
    light: '#4FC3F7',
    dark: '#01579B',
  },
  background: {
    default: '#F5F5F5',
    paper: '#FFFFFF',
  },
  text: {
    primary: '#212121',
    secondary: '#757575',
  },
};

const mparivahanTheme = createTheme({
  palette: mparivahanPalette,

  typography: {
    fontFamily: '"Roboto", "Segoe UI", sans-serif',
    h4: { fontWeight: 700, color: '#0D47A1' },
    h5: { fontWeight: 600, color: '#212121' },
    h6: { fontWeight: 600, color: '#1565C0' },
    subtitle1: { fontWeight: 500, color: '#424242' },
    subtitle2: { fontWeight: 500, color: '#757575', fontSize: '0.8rem' },
    body1: { color: '#424242' },
    body2: { color: '#757575' },
    button: { fontWeight: 600, letterSpacing: 0.5 },
  },

  shape: {
    borderRadius: 12,
  },

  components: {
    MuiCard: {
      defaultProps: { elevation: 2 },
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid #E0E0E0',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(21,101,192,0.12)',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          padding: '10px 24px',
          fontSize: '0.9rem',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #1565C0 0%, #1976D2 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #FF6F00 0%, #FF8F00 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #E65100 0%, #FF6F00 100%)',
          },
        },
        outlined: {
          borderWidth: 2,
          '&:hover': { borderWidth: 2 },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)',
          boxShadow: '0 2px 8px rgba(13,71,161,0.3)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
        colorSuccess: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
        colorError: { backgroundColor: '#FFEBEE', color: '#C62828' },
        colorWarning: { backgroundColor: '#FFF8E1', color: '#F57F17' },
        colorInfo: { backgroundColor: '#E1F5FE', color: '#0277BD' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #E0E0E0',
          backgroundColor: '#FFFFFF',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          '&.Mui-selected': {
            backgroundColor: '#E3F2FD',
            color: '#1565C0',
            '&:hover': { backgroundColor: '#BBDEFB' },
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '&.Mui-focused fieldset': { borderColor: '#1565C0' },
          },
          '& .MuiInputLabel-root.Mui-focused': { color: '#1565C0' },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#263238',
          fontSize: '0.75rem',
          borderRadius: 6,
        },
      },
    },
  },
});

export default mparivahanTheme;
