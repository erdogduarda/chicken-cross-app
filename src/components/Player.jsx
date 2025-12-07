import React from 'react';

const Player = ({ x, y, size, visualY, colWidth }) => {
  const style = {
    left: `${x * colWidth}%`,
    bottom: `${visualY}%`, // Use bottom for infinite scrolling
    width: `${colWidth}%`,
    height: `${size}%`, // This is percentage of container height
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  // Calculate aspect ratio to keep chicken square
  // We use an inner container that maintains aspect ratio
  return (
    <div className="player" style={style}>
      <div className="player-shape" style={{
        width: '80%',
        height: 'auto',
        aspectRatio: '1/1',
      }} />
    </div>
  );
};

export default Player;
