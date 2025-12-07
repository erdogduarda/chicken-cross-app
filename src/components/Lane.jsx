import React from 'react';

const Lane = ({ type, obstacles, bottom, height }) => {
  const style = {
    bottom: `${bottom}%`,
    height: `${height}%`,
  };

  return (
    <div className={`lane ${type}`} style={style}>
      {obstacles.map((obs, i) => (
        <div
          key={i}
          className={`obstacle ${obs.type}`}
          style={{
            left: `${obs.x}%`,
            width: `${obs.width}%`
          }}
        >
          {obs.type === 'car' && <div className="car-shape" />}
          {obs.type === 'coin' && <div className="coin-shape" />}
        </div>
      ))}
    </div>
  );
};

export default Lane;
