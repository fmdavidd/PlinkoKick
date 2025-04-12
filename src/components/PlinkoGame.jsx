import { useEffect, useRef, useState } from 'react';
import { 
  Engine, Runner, World, Events, Mouse, 
  MouseConstraint, Body, Query 
} from 'matter-js';

// Importar utilidades
import { GAME_DIMENSIONS, BOARD_CONFIG, COLORS, COLLISION_CATEGORIES, TIMINGS } from '../utils/constants';
import { createBall, generateGaussianPosition, resetBallPosition } from '../utils/physics';
import { processBallInBucket, processBallElimination, findClosestBucket, toggleBucketType } from '../utils/gameLogic';
import { 
  setupEngine, createPegs, createWalls, createBarrier, 
  createBuckets, createDragLimit, startEngine, cleanupEngine 
} from '../utils/matterHelpers';

/**
 * Hook personalizado para el juego Plinko
 * @param {Object} options - Opciones de configuración
 * @param {Function} options.onBallChange - Callback para cambios en las bolas
 * @returns {Object} - Propiedades y métodos del juego
 */
const usePlinkoGame = ({ onBallChange }) => {
  // Referencias para Matter.js - creamos el ref del escenario internamente
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const mouseConstraintRef = useRef(null);
  
  // Estado para bolas y control de pulsar botón
  const [heldBall, setHeldBall] = useState(null);
  const [canDrop, setCanDrop] = useState(true);
  
  // Estado para calcular posiciones de caída (para el estado externo)
  const [fallPositionsState, setFallPositionsState] = useState([]);
  
  // Inicializar el juego
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Configurar el motor y renderizador
    const { engine, render } = setupEngine(sceneRef);
    engineRef.current = engine;
    renderRef.current = render;
    
    // Crear pegs
    const { pegs, lastPegRowY } = createPegs();
    
    // Calcular posiciones
    const { WIDTH, PEG_SPACING, BUCKET_HEIGHT } = GAME_DIMENSIONS;
    const { START_PINS, TOTAL_ROWS } = BOARD_CONFIG;
    const lastRowPins = START_PINS + TOTAL_ROWS - 1;
    
    // Calcular posiciones para todos los elementos
    const rowWidth = (lastRowPins - 1) * PEG_SPACING;
    const rowOffset = (WIDTH - rowWidth) / 2;
    const barrierY = lastPegRowY + PEG_SPACING/2;
    const bucketsY = lastPegRowY + GAME_DIMENSIONS.PEG_RADIUS + 30;
    
    // Crear elementos del juego
    const walls = createWalls(WIDTH, GAME_DIMENSIONS.HEIGHT, bucketsY, BUCKET_HEIGHT);
    const barrier = createBarrier(WIDTH, barrierY);
    const dragLimit = createDragLimit(WIDTH, bucketsY);
    const { buckets, fallPositions } = createBuckets(
      lastRowPins, PEG_SPACING, rowOffset, bucketsY, BUCKET_HEIGHT
    );
    
    // Guardar posiciones de caída en el estado para usarlas fuera de este useEffect
    setFallPositionsState(fallPositions);
    
    // Añadir todos los objetos al mundo
    World.add(engine.world, [...walls, ...pegs, dragLimit, barrier, ...buckets]);
    
    // Crear y ejecutar el motor
    const runner = Runner.create();
    runnerRef.current = runner;
    startEngine(render, runner, engine);
    
    // Inicializar controles del mouse y hover
    setTimeout(() => {
      setupMouseControls(engine, render, bucketsY);
    }, 100);
    
    // Configurar eventos de colisión
    setupCollisionEvents(engine, WIDTH, fallPositions);
    
    // Cleanup
    return () => {
      cleanupEngine(renderRef.current, runnerRef.current, engineRef.current);
    };
  }, []);

  // Inicializa los controles del mouse
  const setupMouseControls = (engine, render, bucketsY) => {
    if (!render.canvas) return;
    
    // Crear control del mouse
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false
        }
      }
    });
    
    mouseConstraintRef.current = mouseConstraint;
    
    // Solo permitir interacción con bolas
    mouseConstraint.collisionFilter.mask = COLLISION_CATEGORIES.BALL;
    
    // Configurar mouse del renderizador
    render.mouse = mouse;
    
    // Añadir al mundo
    World.add(engine.world, mouseConstraint);
    
    // Limitar posición Y durante arrastre
    const limitDragPosition = () => {
      if (mouseConstraint.body && mouseConstraint.body.label === 'ball') {
        if (mouseConstraint.body.position.y > bucketsY - 40) {
          Body.setPosition(mouseConstraint.body, {
            x: mouseConstraint.body.position.x,
            y: bucketsY - 40
          });
        }
      }
    };
    
    Events.on(engine, 'beforeUpdate', limitDragPosition);
    
    // Configurar eventos de mouse
    setupMouseEvents(mouseConstraint, mouse, engine, bucketsY);
    
    // Añadir eventos de hover
    if (render.canvas) {
      setupHoverEffects(render.canvas, engine);
    }
  };
  
  // Configurar eventos del mouse para arrastrar y soltar
  const setupMouseEvents = (mouseConstraint, mouse, engine, bucketsY) => {
    Events.on(mouseConstraint, 'startdrag', (event) => {
      const { body } = event;
      if (body && body.label === 'ball') {
        setHeldBall(body.id);
        
        body.collisionFilter.mask = COLLISION_CATEGORIES.WALL;
        body.render.fillStyle = COLORS.BALL_HELD;
      }
    });
    
    Events.on(mouseConstraint, 'enddrag', (event) => {
      const { body } = event;
      if (body && body.label === 'ball') {
        setHeldBall(null);
        
        body.collisionFilter.mask = COLLISION_CATEGORIES.PEG | COLLISION_CATEGORIES.WALL;
        body.render.fillStyle = COLORS.BALL;
        
        if (body.position.y > bucketsY - 30) {
          resetBallPosition(body, body.position.x, 50);
        }
      }
    });
    
    // Selección de bolas con sensor de radio
    Events.on(mouse, 'mousemove', () => {
      if (mouseConstraint.body) return;
      
      const position = mouse.position;
      
      if (mouseConstraint.body && mouseConstraint.body.label === 'ball') {
        if (position.y > bucketsY - 40) {
          position.y = bucketsY - 40;
        }
      }
      
      const bodies = Query.point(engine.world.bodies, position);
      
      if (bodies.length === 0) {
        engine.world.bodies.forEach(body => {
          if (body.label === 'ball' && body.mouseSensorRadius) {
            const dx = body.position.x - position.x;
            const dy = body.position.y - position.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance <= body.mouseSensorRadius) {
              mouseConstraint.body = body;
              
              const fakeEvent = { body };
              Events.trigger(mouseConstraint, 'startdrag', fakeEvent);
            }
          }
        });
      }
    });
    
    // Click para cambiar el tipo de bucket
    Events.on(mouseConstraint, 'mousedown', (event) => {
      const position = mouse.position;
      
      const bodies = Query.point(engine.world.bodies, position);
      
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        
        if (body.label && body.label.startsWith('bucket-')) {
          toggleBucketType(body);
          break;
        }
      }
    });
  };
  
  // Configurar efectos de hover para los buckets
  const setupHoverEffects = (canvas, engine) => {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      let hoveredBucket = null;
      
      engine.world.bodies.forEach(body => {
        if (body.label && body.label.startsWith('bucket-')) {
          const { min, max } = body.bounds;
          
          if (
            mouseX >= min.x && 
            mouseX <= max.x && 
            mouseY >= min.y && 
            mouseY <= max.y
          ) {
            hoveredBucket = body;
            
            canvas.style.cursor = 'pointer';
            
            body.render.lineWidth = 3;
            body.render.strokeStyle = COLORS.HIGHLIGHT;
          } else {
            const parts = body.label.split('-');
            const bucketType = parts[2]; // 'red' or 'green'
            const color = bucketType === 'red' ? COLORS.RED_BUCKET : COLORS.GREEN_BUCKET;
            
            body.render.lineWidth = 0;
            body.render.strokeStyle = color;
          }
        }
      });
      
      if (!hoveredBucket) {
        canvas.style.cursor = 'default';
      }
    });
    
    canvas.addEventListener('mouseleave', () => {
      engine.world.bodies.forEach(body => {
        if (body.label && body.label.startsWith('bucket-')) {
          const parts = body.label.split('-');
          const bucketType = parts[2]; // 'red' or 'green'
          const color = bucketType === 'red' ? COLORS.RED_BUCKET : COLORS.GREEN_BUCKET;
          
          body.render.lineWidth = 0;
          body.render.strokeStyle = color;
        }
      });
    });
  };
  
  // Configurar eventos de colisión
  const setupCollisionEvents = (engine, width, fallPositions) => {
    Events.on(engine, 'collisionStart', (event) => {
      const pairs = event.pairs;
      
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const labels = [pair.bodyA.label, pair.bodyB.label];
        
        // Colisiones con la barrera
        if (labels.includes('barrier')) {
          const barrier = labels.includes('barrier') ? (pair.bodyA.label === 'barrier' ? pair.bodyA : pair.bodyB) : null;
          const ball = pair.bodyA === barrier ? pair.bodyB : pair.bodyA;
          
          if (ball.label === 'ball' && !ball.processed) {
            ball.processed = true;
            
            const closestBucketIndex = findClosestBucket(ball, fallPositions);
            
            const matchingBucket = engine.world.bodies.find(body => 
              body.label && (body.label === `bucket-${closestBucketIndex}-red` || 
                           body.label === `bucket-${closestBucketIndex}-green`)
            );
            
            if (matchingBucket) {
              processBallInBucket(engine, ball, matchingBucket, width);
              
              // Notificar cambio de bola si hay callback
              if (onBallChange) onBallChange();
            }
          }
        }
        
        // Colisiones con paredes de eliminación
        if ((labels.includes('elimination-wall-left') || 
             labels.includes('elimination-wall-right') || 
             labels.includes('elimination-wall-top')) && 
            labels.includes('ball')) {
            
          const ball = labels.includes('ball') ? 
                      (pair.bodyA.label === 'ball' ? pair.bodyA : pair.bodyB) : null;
                      
          if (ball) {
            processBallElimination(engine, ball);
            
            // Notificar cambio de bola si hay callback
            if (onBallChange) onBallChange();
          }
        }
      }
    });
  };
  
  // Función para soltar una nueva bola
  const dropBall = () => {
    if (!canDrop || !engineRef.current) return;
    
    // Calcular posición
    const x = generateGaussianPosition(GAME_DIMENSIONS.WIDTH);
    
    // Crear y soltar la bola
    createBall(engineRef.current, x);
    
    // Configurar anti-spam
    setCanDrop(false);
    setTimeout(() => setCanDrop(true), TIMINGS.DROP_COOLDOWN);
    
    // Notificar cambio de bola si hay callback
    if (onBallChange) onBallChange();
  };
  
  return {
    sceneRef,
    canDrop,
    dropBall
  };
};

export default usePlinkoGame;