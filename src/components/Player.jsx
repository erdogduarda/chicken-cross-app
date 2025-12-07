import React from 'react';

const Player = ({ x, y, size, visualY, colWidth }) => {
  const style = {
    left: `${x * colWidth}%`,
    bottom: `${visualY}%`, // Use bottom for infinite scrolling
    width: `${colWidth}%`,
    height: `${size}%`,
  };

  return (
    <div className="player" style={style}>
      <div className="player-shape" />
    </div>
  );
};

export default Player;
