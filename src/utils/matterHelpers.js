import { Engine, Render, Runner, World, Bodies, Events } from 'matter-js';
import { GAME_DIMENSIONS, COLORS, COLLISION_CATEGORIES, BOARD_CONFIG, PHYSICS } from './constants';
import { calculatePegRadius } from './physics';

/**
 * Crea el motor de física y el renderizador
 */
export const setupEngine = (sceneRef) => {
  // Create engine with gravity
  const engine = Engine.create({
    gravity: { x: 0, y: PHYSICS.GRAVITY }
  });
  
  // Create renderer
  const render = Render.create({
    element: sceneRef.current,
    engine: engine,
    options: {
      width: GAME_DIMENSIONS.WIDTH,
      height: GAME_DIMENSIONS.HEIGHT,
      wireframes: false,
      background: COLORS.BACKGROUND,
      showSleeping: false,
      showDebug: false,
      showBroadphase: false,
      showBounds: false,
      showVelocity: false,
      showCollisions: false,
      showSeparations: false,
      showAxes: false,
      showPositions: false,
      showAngleIndicator: false,
      showIds: false,
      showShadows: false
    }
  });
  
  return { engine, render };
};

/**
 * Crea los pegs en un patrón triangular
 */
export const createPegs = () => {
  const pegs = [];
  let pegLastRowY = 0;
  const { WIDTH, PEG_SPACING } = GAME_DIMENSIONS;
  const { START_PINS, TOTAL_ROWS, TOP_MARGIN } = BOARD_CONFIG;
  
  for (let row = 0; row < TOTAL_ROWS; row++) {
    const pinsInRow = START_PINS + row;
    const rowWidth = (pinsInRow - 1) * PEG_SPACING;
    const rowOffset = (WIDTH - rowWidth) / 2;
    
    for (let col = 0; col < pinsInRow; col++) {
      let posX = rowOffset + col * PEG_SPACING;
      const y = TOP_MARGIN + row * PEG_SPACING;
      pegLastRowY = y;
      
      // Calcular qué tan centrado está este peg
      const distanceFromCenter = Math.abs(col - (pinsInRow - 1) / 2);
      const normalizedDistance = distanceFromCenter / ((pinsInRow - 1) / 2);
      
      // Calcular el radio del peg según su distancia al centro
      const currentPegRadius = calculatePegRadius(normalizedDistance, GAME_DIMENSIONS.PEG_RADIUS);
      
      // Si es un peg lateral, inclinar ligeramente hacia el centro
      if (normalizedDistance > 0.4 && normalizedDistance < 0.8) {
        const direction = col < (pinsInRow - 1) / 2 ? 1 : -1; // 1=derecha, -1=izquierda
        const tilt = 2 * (normalizedDistance - 0.4) * direction;
        posX += tilt;
      }
      
      const peg = Bodies.circle(posX, y, currentPegRadius, {
        isStatic: true,
        restitution: 0.7,
        friction: 0.1,
        collisionFilter: {
          category: COLLISION_CATEGORIES.PEG,
          mask: 0xFFFFFFFF
        },
        render: { fillStyle: COLORS.PEG }
      });
      
      pegs.push(peg);
    }
  }
  
  return { pegs, lastPegRowY: pegLastRowY };
};

/**
 * Crea las paredes invisibles para limitar el movimiento
 */
export const createWalls = (width, height, bucketsY, bucketHeight) => {
  return [
    // Bottom wall
    Bodies.rectangle(width / 2, bucketsY + bucketHeight, width, 10, { 
      isStatic: true,
      label: 'bottom-wall',
      collisionFilter: {
        category: COLLISION_CATEGORIES.WALL,
        mask: 0xFFFFFFFF
      },
      render: { visible: false }
    }),
    // Left wall
    Bodies.rectangle(-15, height / 2, 40, height * 1.5, { 
      isStatic: true,
      isSensor: true,
      label: 'elimination-wall-left',
      collisionFilter: {
        category: COLLISION_CATEGORIES.WALL,
        mask: 0xFFFFFFFF
      },
      render: { visible: false }
    }),
    // Right wall
    Bodies.rectangle(width + 15, height / 2, 40, height * 1.5, { 
      isStatic: true,
      isSensor: true,
      label: 'elimination-wall-right',
      collisionFilter: {
        category: COLLISION_CATEGORIES.WALL,
        mask: 0xFFFFFFFF
      },
      render: { visible: false }
    }),
    // Top wall
    Bodies.rectangle(width / 2, -15, width * 1.2, 40, {
      isStatic: true,
      isSensor: true,
      label: 'elimination-wall-top',
      collisionFilter: {
        category: COLLISION_CATEGORIES.WALL,
        mask: 0xFFFFFFFF
      },
      render: { visible: false }
    })
  ];
};

/**
 * Crea una barrera invisible que detecta en qué bucket caerá la bola
 */
export const createBarrier = (width, barrierY) => {
  return Bodies.rectangle(width/2, barrierY, width, 5, {
    isStatic: true,
    isSensor: true,
    label: 'barrier',
    collisionFilter: {
      category: COLLISION_CATEGORIES.WALL,
      mask: 0xFFFFFFFF
    },
    render: { 
      fillStyle: COLORS.PEG,
      opacity: 0.0
    }
  });
};

/**
 * Crea los buckets en la parte inferior
 */
export const createBuckets = (lastRowPins, pegSpacing, rowOffset, bucketsY, bucketHeight) => {
  const fallPositions = [];
  
  // Calcular las posiciones entre pegs donde caerían las bolas
  for (let i = 0; i < lastRowPins - 1; i++) {
    fallPositions.push(rowOffset + i * pegSpacing + pegSpacing/2);
  }
  
  // Añadir buckets adicionales en los extremos
  fallPositions.unshift(rowOffset - pegSpacing/2);
  fallPositions.push(rowOffset + (lastRowPins-1) * pegSpacing + pegSpacing/2);
  
  // Crear los buckets
  const buckets = [];
  
  // Primero creamos el bucket grande en el extremo izquierdo
  let leftBucketWidth = pegSpacing * 1.8;
  // Mover el bucket izquierdo más hacia la izquierda para evitar superposición
  let leftBucketX = fallPositions[0] - pegSpacing * 0.4;
  
  const leftBucket = Bodies.rectangle(
    leftBucketX,
    bucketsY,
    leftBucketWidth,
    bucketHeight,
    {
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        category: COLLISION_CATEGORIES.BUCKET,
        mask: 0x0000
      },
      render: { 
        fillStyle: COLORS.RED_BUCKET, // Primer bucket es rojo
        lineWidth: 0,
        strokeStyle: COLORS.RED_BUCKET,
        opacity: 1
      },
      label: `bucket-0-red`,
      isHovered: false
    }
  );
  
  buckets.push(leftBucket);
  
  // Luego creamos los buckets intermedios
  for (let i = 1; i < fallPositions.length - 1; i++) {
    const bucketColor = i % 2 === 0 ? COLORS.RED_BUCKET : COLORS.GREEN_BUCKET;
    const bucketType = i % 2 === 0 ? 'red' : 'green';
    
    const bucket = Bodies.rectangle(
      fallPositions[i],
      bucketsY,
      pegSpacing,
      bucketHeight,
      {
        isStatic: true,
        isSensor: true,
        collisionFilter: {
          category: COLLISION_CATEGORIES.BUCKET,
          mask: 0x0000
        },
        render: { 
          fillStyle: bucketColor,
          lineWidth: 0,
          strokeStyle: bucketColor,
          opacity: 1
        },
        label: `bucket-${i}-${bucketType}`,
        isHovered: false
      }
    );
    
    buckets.push(bucket);
  }
  
  // Finalmente creamos el bucket grande en el extremo derecho
  let rightBucketWidth = pegSpacing * 1.8;
  let rightIndex = fallPositions.length - 1;
  // Mover el bucket derecho más hacia la derecha para evitar superposición
  let rightBucketX = fallPositions[rightIndex] + pegSpacing * 0.4;
  
  const rightBucketType = rightIndex % 2 === 0 ? 'red' : 'green';
  const rightBucketColor = rightIndex % 2 === 0 ? COLORS.RED_BUCKET : COLORS.GREEN_BUCKET;
  
  const rightBucket = Bodies.rectangle(
    rightBucketX,
    bucketsY,
    rightBucketWidth,
    bucketHeight,
    {
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        category: COLLISION_CATEGORIES.BUCKET,
        mask: 0x0000
      },
      render: { 
        fillStyle: rightBucketColor,
        lineWidth: 0,
        strokeStyle: rightBucketColor,
        opacity: 1
      },
      label: `bucket-${rightIndex}-${rightBucketType}`,
      isHovered: false
    }
  );
  
  buckets.push(rightBucket);
  
  return { buckets, fallPositions };
};

/**
 * Crea un límite de arrastre para que no se puedan mover las bolas demasiado abajo
 */
export const createDragLimit = (width, bucketsY) => {
  return Bodies.rectangle(width / 2, bucketsY - 40, width, 10, {
    isStatic: true,
    isSensor: true,
    label: 'drag-limit',
    collisionFilter: {
      category: COLLISION_CATEGORIES.WALL,
    },
    render: { 
      visible: false
    }
  });
};

/**
 * Inicia el motor de Matter.js
 */
export const startEngine = (render, runner, engine) => {
  Render.run(render);
  Runner.run(runner, engine);
};

/**
 * Detiene y limpia el motor de Matter.js
 */
export const cleanupEngine = (render, runner, engine) => {
  if (render) {
    Render.stop(render);
  }
  
  if (runner) {
    Runner.stop(runner);
  }
  
  if (engine) {
    World.clear(engine.world, false);
    Engine.clear(engine);
  }
  
  if (render && render.canvas) {
    render.canvas.remove();
    render.canvas = null;
    render.context = null;
    render.textures = {};
  }
};