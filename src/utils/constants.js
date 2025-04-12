// Categorías de colisión para Matter.js
export const COLLISION_CATEGORIES = {
    BALL: 0x0001,
    PEG: 0x0002,
    BUCKET: 0x0004,
    WALL: 0x0008
  };
  
  // Dimensiones del juego
  export const GAME_DIMENSIONS = {
    WIDTH: 600,
    HEIGHT: 600,
    PEG_RADIUS: 5,
    BALL_RADIUS: 10,
    BALL_SENSOR_RADIUS: 25,
    PEG_SPACING: 32,
    BUCKET_HEIGHT: 30
  };
  
  // Configuración del tablero
  export const BOARD_CONFIG = {
    START_PINS: 3,
    TOTAL_ROWS: 12,
    TOP_MARGIN: 60
  };
  
  // Colores
  export const COLORS = {
    BACKGROUND: '#0e1621',
    PEG: '#ffffff',
    BALL: '#ff5588',
    BALL_HELD: '#ffcc00',
    RED_BUCKET: '#ff3366',
    GREEN_BUCKET: '#33cc66',
    HIGHLIGHT: '#ffffff'
  };
  
  // Física
  export const PHYSICS = {
    GRAVITY: 0.5,
    RESTITUTION: 0.5,
    FRICTION: 0.1,
    FRICTION_AIR: 0.01,
    DENSITY: 0.8
  };
  
  // Tiempos
  export const TIMINGS = {
    DROP_COOLDOWN: 150,
    BALL_REMOVE_DELAY: 300,
    BALL_RESPAWN_DELAY: 35
  };