/**
 * CortePro DIY - Presets y Tamaños Comerciales (Métrico e Imperial)
 */

export const STANDARD_SHEETS_MM = [
  { name: 'Tablero Estándar (2440 × 1220 mm)', width: 2440, height: 1220, price: 45 },
  { name: 'Contrachapado Grande (2500 × 1250 mm)', width: 2500, height: 1250, price: 58 },
  { name: 'Tablero Euro Melamina (2800 × 2070 mm)', width: 2800, height: 2070, price: 92 },
  { name: 'Medio Tablero Cuadrado (1220 × 1220 mm)', width: 1220, height: 1220, price: 26 },
  { name: 'Tablero Bricolaje (1200 × 600 mm)', width: 1200, height: 600, price: 16 },
  { name: 'Panel Pequeño Hobby (800 × 400 mm)', width: 800, height: 400, price: 9 }
];

export const STANDARD_SHEETS_IN = [
  { name: 'Tablero 4x8 ft Estándar (96 × 48 in)', width: 96, height: 48, price: 45 },
  { name: 'Tablero 5x5 ft Báltico (60 × 60 in)', width: 60, height: 60, price: 55 },
  { name: 'Medio Tablero 4x4 ft (48 × 48 in)', width: 48, height: 48, price: 26 },
  { name: 'Panel 2x4 ft Proyecto (48 × 24 in)', width: 48, height: 24, price: 16 },
  { name: 'Panel 2x2 ft Hobby (24 × 24 in)', width: 24, height: 24, price: 10 }
];

export const STANDARD_SHEETS = STANDARD_SHEETS_MM;

export const PROJECT_PRESETS = [
  {
    id: 'kitchen-cabinet',
    name: 'Mueble Bajo de Cocina / Taller (800×600×560 mm)',
    description: 'Módulo estándar para cocina o banco de trabajo con balda interior y puertas.',
    unit: 'mm',
    stockSheets: [
      { id: 's1', name: 'Tablero Contrachapado 18mm (2440×1220)', width: 2440, height: 1220, quantity: 1, price: 48 }
    ],
    settings: { kerf: 3, margin: 10, algorithm: 'auto', unit: 'mm' },
    pieces: [
      { id: 'p1', name: 'Costado Izquierdo', width: 760, height: 560, quantity: 1, allowRotation: false, color: '#3b82f6' },
      { id: 'p2', name: 'Costado Derecho', width: 760, height: 560, quantity: 1, allowRotation: false, color: '#3b82f6' },
      { id: 'p3', name: 'Base Inferior', width: 568, height: 560, quantity: 1, allowRotation: true, color: '#10b981' },
      { id: 'p4', name: 'Balda Interior', width: 568, height: 530, quantity: 1, allowRotation: true, color: '#10b981' },
      { id: 'p5', name: 'Travesaño Sup Delantero', width: 568, height: 90, quantity: 1, allowRotation: true, color: '#f59e0b' },
      { id: 'p6', name: 'Travesaño Sup Trasero', width: 568, height: 90, quantity: 1, allowRotation: true, color: '#f59e0b' },
      { id: 'p7', name: 'Puerta Izquierda', width: 755, height: 295, quantity: 1, allowRotation: false, color: '#8b5cf6' },
      { id: 'p8', name: 'Puerta Derecha', width: 755, height: 295, quantity: 1, allowRotation: false, color: '#8b5cf6' }
    ]
  },
  {
    id: 'bookshelf-modular',
    name: 'Estantería Modular de 4 Baldas (1800×800×300 mm)',
    description: 'Estantería vertical práctica para libros, salón o almacén.',
    unit: 'mm',
    stockSheets: [
      { id: 's1', name: 'Tablero Pino Alistonado 18mm (2440×1220)', width: 2440, height: 1220, quantity: 1, price: 55 }
    ],
    settings: { kerf: 3.2, margin: 10, algorithm: 'auto', unit: 'mm' },
    pieces: [
      { id: 'p1', name: 'Lateral Izquierdo', width: 1800, height: 300, quantity: 1, allowRotation: false, color: '#3b82f6' },
      { id: 'p2', name: 'Lateral Derecho', width: 1800, height: 300, quantity: 1, allowRotation: false, color: '#3b82f6' },
      { id: 'p3', name: 'Techo', width: 764, height: 300, quantity: 1, allowRotation: true, color: '#10b981' },
      { id: 'p4', name: 'Suelo', width: 764, height: 300, quantity: 1, allowRotation: true, color: '#10b981' },
      { id: 'p5', name: 'Balda 1', width: 764, height: 285, quantity: 1, allowRotation: true, color: '#f59e0b' },
      { id: 'p6', name: 'Balda 2', width: 764, height: 285, quantity: 1, allowRotation: true, color: '#f59e0b' },
      { id: 'p7', name: 'Balda 3', width: 764, height: 285, quantity: 1, allowRotation: true, color: '#f59e0b' },
      { id: 'p8', name: 'Zócalo Frontal', width: 764, height: 70, quantity: 1, allowRotation: true, color: '#ec4899' }
    ]
  },
  {
    id: 'toolbox-pro',
    name: 'Caja de Herramientas de Taller con Bandeja',
    description: 'Caja robusta de contrachapado de abedul con compartimentos organizadores.',
    unit: 'mm',
    stockSheets: [
      { id: 's1', name: 'Tablero Bricolaje (1200×600 mm)', width: 1200, height: 600, quantity: 1, price: 16 }
    ],
    settings: { kerf: 2.8, margin: 5, algorithm: 'auto', unit: 'mm' },
    pieces: [
      { id: 'p1', name: 'Base Principal', width: 480, height: 220, quantity: 1, allowRotation: true, color: '#10b981' },
      { id: 'p2', name: 'Costado Largo Frontal', width: 500, height: 180, quantity: 1, allowRotation: true, color: '#3b82f6' },
      { id: 'p3', name: 'Costado Largo Trasero', width: 500, height: 180, quantity: 1, allowRotation: true, color: '#3b82f6' },
      { id: 'p4', name: 'Testero con Asa Izq', width: 220, height: 280, quantity: 1, allowRotation: false, color: '#f59e0b' },
      { id: 'p5', name: 'Testero con Asa Der', width: 220, height: 280, quantity: 1, allowRotation: false, color: '#f59e0b' },
      { id: 'p6', name: 'Separador Interior', width: 210, height: 110, quantity: 2, allowRotation: true, color: '#8b5cf6' },
      { id: 'p7', name: 'Bandeja Fondo', width: 450, height: 180, quantity: 1, allowRotation: true, color: '#06b6d4' }
    ]
  },
  {
    id: 'coffee-table',
    name: 'Mesa de Centro Nórdica con Cajón (1000×500 mm)',
    description: 'Mesa de centro contemporánea con balda inferior de revistas y cajón oculto.',
    unit: 'mm',
    stockSheets: [
      { id: 's1', name: 'Tablero Roble/Pino (2440×1220 mm)', width: 2440, height: 1220, quantity: 1, price: 62 }
    ],
    settings: { kerf: 3, margin: 10, algorithm: 'auto', unit: 'mm' },
    pieces: [
      { id: 'p1', name: 'Sobre / Tapa Superior', width: 1000, height: 500, quantity: 1, allowRotation: false, color: '#d97706' },
      { id: 'p2', name: 'Balda Inferior', width: 960, height: 480, quantity: 1, allowRotation: false, color: '#d97706' },
      { id: 'p3', name: 'Costado Estructura', width: 480, height: 380, quantity: 2, allowRotation: false, color: '#3b82f6' },
      { id: 'p4', name: 'Divisor Central', width: 480, height: 140, quantity: 1, allowRotation: true, color: '#10b981' },
      { id: 'p5', name: 'Frontal Cajón', width: 460, height: 130, quantity: 1, allowRotation: false, color: '#f59e0b' },
      { id: 'p6', name: 'Laterales Cajón', width: 420, height: 110, quantity: 2, allowRotation: true, color: '#8b5cf6' },
      { id: 'p7', name: 'Trasera Cajón', width: 430, height: 110, quantity: 1, allowRotation: true, color: '#8b5cf6' },
      { id: 'p8', name: 'Fondo Cajón', width: 430, height: 400, quantity: 1, allowRotation: true, color: '#06b6d4' }
    ]
  }
];
