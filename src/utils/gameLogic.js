import { World, Body } from 'matter-js';
import { COLORS, COLLISION_CATEGORIES, TIMINGS } from './constants';
import { resetBallPosition, generateGaussianPosition } from './physics';

/**
 * Procesa el comportamiento cuando una bola cae en un bucket
 */
export const processBallInBucket = (engine, ball, matchingBucket, width) => {
  if (!matchingBucket) return;
  
  // Determinar si es rojo o verde basado en la etiqueta actual
  const isRed = matchingBucket.label.endsWith('-red');
  
  if (isRed) {
    // Contenedor rojo - eliminar la pelota
    ball.render.fillStyle = COLORS.RED_BUCKET;
    
    // Eliminar la pelota después de un breve retraso
    setTimeout(() => {
      World.remove(engine.world, ball);
    }, TIMINGS.BALL_REMOVE_DELAY);
  } else {
    // Contenedor verde - reaparecer la pelota en la parte superior
    ball.render.fillStyle = COLORS.GREEN_BUCKET;
    
    // Reposicionar la pelota después de un breve retraso
    setTimeout(() => {
      // Calcular nueva posición aleatoria
      const x = generateGaussianPosition(width);
      
      // Reposicionar la pelota en la parte superior
      resetBallPosition(ball, x, 50);
      ball.processed = false; // Permitir que sea procesada de nuevo
      ball.render.fillStyle = COLORS.BALL; // Restablecer color
    }, TIMINGS.BALL_RESPAWN_DELAY);
  }
};

/**
 * Procesa la eliminación de una bola cuando sale de los límites
 */
export const processBallElimination = (engine, ball) => {
  if (ball && !ball.eliminationProcessed) {
    // Marcar como procesada para evitar múltiples activaciones
    ball.eliminationProcessed = true;
    
    // Efecto visual antes de eliminar
    ball.render.fillStyle = '#ff0000'; // Rojo brillante
    
    // Eliminar la pelota después de un breve retraso
    setTimeout(() => {
      World.remove(engine.world, ball);
    }, 100);
  }
};

/**
 * Encuentra el bucket más cercano a una posición dada
 */
export const findClosestBucket = (ball, fallPositions) => {
  let closestBucketIndex = 0;
  let minDistance = Infinity;
  
  for (let j = 0; j < fallPositions.length; j++) {
    const distance = Math.abs(ball.position.x - fallPositions[j]);
    if (distance < minDistance) {
      minDistance = distance;
      closestBucketIndex = j;
    }
  }
  
  return closestBucketIndex;
};

/**
 * Cambia el tipo de un bucket (rojo/verde)
 */
export const toggleBucketType = (body) => {
  // Extract bucket index and type from label
  const parts = body.label.split('-');
  const bucketIndex = parseInt(parts[1]);
  const bucketType = parts[2]; // 'red' or 'green'
  
  // Toggle the bucket color/type
  const newType = bucketType === 'red' ? 'green' : 'red';
  const newColor = newType === 'red' ? COLORS.RED_BUCKET : COLORS.GREEN_BUCKET;
  
  // Update the bucket's appearance and label
  body.render.fillStyle = newColor;
  body.render.lineWidth = 0;
  body.render.strokeStyle = newColor;
  body.label = `bucket-${bucketIndex}-${newType}`;
  
  return body;
};