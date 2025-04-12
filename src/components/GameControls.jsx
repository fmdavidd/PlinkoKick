import React from 'react';

/**
 * Componente para los controles del juego
 */
const GameControls = ({ onDropBall, canDrop }) => {
  return (
    <div className="controls">
      <button 
        onClick={onDropBall} 
        className={`drop-button ${!canDrop ? 'disabled' : ''}`}
        disabled={!canDrop}
      >
        Drop Ball
      </button>
    </div>
  );
};

export default GameControls;