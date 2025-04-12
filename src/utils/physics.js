import { Bodies, Body, World } from 'matter-js';
import { COLLISION_CATEGORIES, COLORS, PHYSICS, GAME_DIMENSIONS } from './constants';

/**
 * Genera una posición aleatoria con distribución normal (campana de Gauss)
 */
export const generateGaussianPosition = (width) => {
  // Usar Box-Muller para generar una distribución normal
  const u1 = Math.random();
  const u2 = Math.random();
  
  // Transformación Box-Muller
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  
  // Aplicar desviación estándar pequeña para centralizar más
  const stdDeviation = 10;
  let randomPosition = z0 * stdDeviation;
  
  // Limitar la posición estrictamente al área central
  randomPosition = Math.max(-width/15, Math.min(width/15, randomPosition));
  
  // Posicionar en el centro del tablero con la desviación calculada
  return width / 2 + randomPosition;
};

/**
 * Crea una bola con propiedades físicas
 */
export const createBall = (engine, x) => {
  if (!engine) return null;
  
  const ball = Bodies.circle(x, 50, GAME_DIMENSIONS.BALL_RADIUS, {
    restitution: PHYSICS.RESTITUTION,
    friction: PHYSICS.FRICTION,
    frictionAir: PHYSICS.FRICTION_AIR,
    density: PHYSICS.DENSITY,
    label: 'ball',
    collisionFilter: {
      category: COLLISION_CATEGORIES.BALL,
      mask: COLLISION_CATEGORIES.PEG | COLLISION_CATEGORIES.WALL // Solo colisiona con pegs y paredes
    },
    render: {
      fillStyle: COLORS.BALL
    },
    mouseSensorRadius: GAME_DIMENSIONS.BALL_SENSOR_RADIUS
  });
  
  // Añadir al mundo
  World.add(engine.world, [ball]);
  return ball;
};

/**
 * Calcular el radio del peg según su distancia al centro
 */
export const calculatePegRadius = (normalizedDistance, baseRadius) => {
  if (normalizedDistance < 0.8) {
    // Cálculo exagerado: pegs centrales más grandes, pegs laterales más pequeños
    return baseRadius * (1.3 - 0.6 * normalizedDistance);
  }
  return baseRadius;
};

/**
 * Mover una bola a una nueva posición
 */
export const resetBallPosition = (ball, x, y) => {
  Body.setPosition(ball, { x, y });
  Body.setVelocity(ball, { x: 0, y: 0 });
  Body.setAngularVelocity(ball, 0);
};