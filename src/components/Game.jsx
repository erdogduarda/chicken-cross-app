import React, { useState, useEffect, useRef, useCallback } from 'react';
import Player from './Player';
import Lane from './Lane';

const VISIBLE_ROWS = 15;
const COLS = 11; // Odd number for centering
const COL_WIDTH = 100 / COLS;
const PLAYER_OFFSET_ROWS = 3; // Player stays at this row index from bottom visually

const Game = () => {
  const [player, setPlayer] = useState({ x: Math.floor(COLS / 2), y: 0 }); // y is absolute row index
  const [lanes, setLanes] = useState({}); // Map of rowIndex -> laneData
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const requestRef = useRef();
  const lastTimeRef = useRef();

  // Audio Context
  const audioCtxRef = useRef(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };
  const playSound = (type) => {
    if (!audioCtxRef.current || isMuted) return;
    
    const osc = audioCtxRef.current.createOscillator();
    const gain = audioCtxRef.current.createGain();
    osc.connect(gain);
    gain.connect(audioCtxRef.current.destination);

    if (type === 'jump') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, audioCtxRef.current.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, audioCtxRef.current.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.1);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.1);
    } else if (type === 'crash') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, audioCtxRef.current.currentTime);
      osc.frequency.exponentialRampToValueAtTime(10, audioCtxRef.current.currentTime + 0.3);
      gain.gain.setValueAtTime(0.2, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.3);
    } else if (type === 'coin') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, audioCtxRef.current.currentTime);
      osc.frequency.exponentialRampToValueAtTime(2000, audioCtxRef.current.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.1);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.1);
    }
  };

  // Generate a single lane
  const generateLane = (index) => {
    // Determine gap based on score (max distance)
    // "Every five tile have a rest place and after score reacher a thousand its every 6 tile and so on"
    // Base gap is 5. Increase by 1 for every 1000 score.
    const currentGap = 5 + Math.floor(index / 1000);
    
    let type = 'road';
    let speed = 0;
    let obstacles = [];

    if (index === 0) {
      type = 'grass'; // Start line
    } else if (index % currentGap === 0) {
      type = 'grass'; // Rest place
    } else {
      type = 'road';
      // Random speed based on difficulty (index)
      const difficultyMultiplier = 1 + (index * 0.001);
      speed = (Math.random() * 0.02 + 0.01) * difficultyMultiplier * (Math.random() < 0.5 ? 1 : -1);
      
      // Add cars
      const numCars = Math.floor(Math.random() * 2) + 1;
      const carWidth = 15;
      const minGap = 20; // Minimum gap between cars in %

      for (let j = 0; j < numCars; j++) {
        let attempts = 0;
        let placed = false;
        
        while (!placed && attempts < 10) {
          const x = Math.random() * (100 - carWidth);
          let overlap = false;
          
          for (const obs of obstacles) {
            // Check if this new position overlaps with existing obstacle + gap
            if (x < obs.x + obs.width + minGap && x + carWidth + minGap > obs.x) {
              overlap = true;
              break;
            }
          }
          
          if (!overlap) {
            obstacles.push({
              x,
              width: carWidth,
              type: 'car'
            });
            placed = true;
          }
          attempts++;
        }
      }
      
      // Add coins occasionally (20% chance per road lane)
      if (Math.random() < 0.2) {
        let coinPlaced = false;
        let attempts = 0;
        while (!coinPlaced && attempts < 5) {
          const x = Math.random() * 90;
          let overlap = false;
          for (const obs of obstacles) {
             if (x < obs.x + obs.width + 5 && x + 5 > obs.x) {
               overlap = true;
               break;
             }
          }
          if (!overlap) {
            obstacles.push({
              x,
              width: 5, // Small width for coin
              type: 'coin'
            });
            coinPlaced = true;
          }
          attempts++;
        }
      }
    }

    return { type, speed, obstacles, id: index };
  };

  // Ensure lanes exist for the visible range
  const ensureLanes = useCallback(() => {
    setLanes(prevLanes => {
      const newLanes = { ...prevLanes };
      const startRow = Math.max(0, player.y - PLAYER_OFFSET_ROWS);
      const endRow = startRow + VISIBLE_ROWS + 5; // Buffer

      let changed = false;
      for (let i = startRow; i < endRow; i++) {
        if (!newLanes[i]) {
          newLanes[i] = generateLane(i);
          changed = true;
        }
      }
      
      // Cleanup old lanes to save memory
      Object.keys(newLanes).forEach(key => {
        if (parseInt(key) < startRow - 5) {
          delete newLanes[key];
          changed = true;
        }
      });

      return changed ? newLanes : prevLanes;
    });
  }, [player.y]);

  useEffect(() => {
    ensureLanes();
  }, [ensureLanes]);

  // Game Loop
  const update = (time) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = time - lastTimeRef.current;
      
      if (!gameOver) {
        setLanes(prevLanes => {
          const newLanes = { ...prevLanes };
          let changed = false;
          
          Object.keys(newLanes).forEach(key => {
            const lane = newLanes[key];
            if (lane.speed !== 0) {
              const move = lane.speed * deltaTime;
              const newObstacles = lane.obstacles.map(obs => {
                // Only move cars, coins stay static
                if (obs.type === 'coin') return obs;
                
                let newX = obs.x + move;
                if (newX > 100) newX = -obs.width;
                if (newX < -obs.width) newX = 100;
                return { ...obs, x: newX };
              });
              newLanes[key] = { ...lane, obstacles: newObstacles };
              changed = true;
            }
          });
          
          return changed ? newLanes : prevLanes;
        });
      }
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameOver]);

  // Collision Detection
  useEffect(() => {
    if (gameOver) return;

    const currentLane = lanes[player.y];
    if (!currentLane) return;

    const playerLeft = player.x * COL_WIDTH + 2; 
    const playerRight = (player.x + 1) * COL_WIDTH - 2;

    if (currentLane.type === 'road') {
      // Check for collisions with cars
      const hit = currentLane.obstacles.some(obs => {
        if (obs.type !== 'car') return false;
        const obsLeft = obs.x;
        const obsRight = obs.x + obs.width;
        return (playerLeft < obsRight && playerRight > obsLeft);
      });

      if (hit) {
        setGameOver(true);
        playSound('crash');
        if (navigator.vibrate) navigator.vibrate(200);
      }
      
      // Check for coin collection
      const coinIndex = currentLane.obstacles.findIndex(obs => {
        if (obs.type !== 'coin') return false;
        const obsLeft = obs.x;
        const obsRight = obs.x + obs.width;
        return (playerLeft < obsRight && playerRight > obsLeft);
      });
      
      if (coinIndex !== -1) {
        // Collect coin
        playSound('coin');
        setCoins(prev => prev + 1);
        // Remove coin from lane
        setLanes(prev => {
          const newLanes = { ...prev };
          const newObstacles = [...newLanes[player.y].obstacles];
          newObstacles.splice(coinIndex, 1);
          newLanes[player.y] = { ...newLanes[player.y], obstacles: newObstacles };
          return newLanes;
        });
      }
    }
  }, [player, lanes, gameOver]);

  // Controls
  const move = (dx, dy) => {
    if (gameOver) return;
    
    // Initialize audio on first interaction
    initAudio();
    
    setPlayer(prev => {
      const newX = Math.max(0, Math.min(COLS - 1, prev.x + dx));
      const newY = Math.max(0, prev.y + dy); // Can go up infinitely, but not below 0
      
      if (newY > score) {
        setScore(newY);
      }
      
      if (newX !== prev.x || newY !== prev.y) {
        playSound('jump');
        if (navigator.vibrate) navigator.vibrate(10);
      }
      
      return { x: newX, y: newY };
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch(e.key) {
        case 'ArrowUp': move(0, 1); break; // Up increases Y
        case 'ArrowDown': move(0, -1); break; // Down decreases Y
        case 'ArrowLeft': move(-1, 0); break;
        case 'ArrowRight': move(1, 0); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, score]); // Added score to dependency

  // Rendering
  // We render lanes relative to the player's position to simulate camera movement
  // The player stays at PLAYER_OFFSET_ROWS from the bottom
  // So the bottom-most rendered lane should be player.y - PLAYER_OFFSET_ROWS
  
  const startRenderRow = Math.max(0, player.y - PLAYER_OFFSET_ROWS);
  const visibleLanes = [];
  
  // Render extra lanes for smooth sliding
  for (let i = startRenderRow - 1; i < startRenderRow + VISIBLE_ROWS + 1; i++) {
    if (lanes[i]) {
      visibleLanes.push({
        ...lanes[i],
        visualBottom: (i - startRenderRow) * (100 / VISIBLE_ROWS),
        height: (100 / VISIBLE_ROWS)
      });
    }
  }

  // Player's visual position is fixed relative to the container, unless we are at the very start
  // If player.y < PLAYER_OFFSET_ROWS, the camera is clamped to 0, so player moves up visually
  // If player.y >= PLAYER_OFFSET_ROWS, player is fixed at PLAYER_OFFSET_ROWS * height
  
  let playerVisualY;
  if (player.y < PLAYER_OFFSET_ROWS) {
    playerVisualY = player.y * (100 / VISIBLE_ROWS);
  } else {
    playerVisualY = PLAYER_OFFSET_ROWS * (100 / VISIBLE_ROWS);
  }

  // Touch handling
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);

  const handleTouchStart = (e) => {
    touchEndRef.current = null;
    touchStartRef.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };
  };

  const handleTouchMove = (e) => {
    touchEndRef.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;
    
    const distanceX = touchStartRef.current.x - touchEndRef.current.x;
    const distanceY = touchStartRef.current.y - touchEndRef.current.y;
    const minSwipeDistance = 30; // Lower threshold for better responsiveness

    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (Math.abs(distanceX) > minSwipeDistance) {
        if (distanceX > 0) move(-1, 0); // Swipe Left
        else move(1, 0); // Swipe Right
      }
    } else {
      if (Math.abs(distanceY) > minSwipeDistance) {
        if (distanceY > 0) move(0, 1); // Swipe Up
        else move(0, -1); // Swipe Down
      }
    }
  };

  return (
    <div 
      className={`game-container ${isNightMode ? 'night-mode' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="ui-overlay">
        <span>Score: {score * 10}</span>
        <span style={{ marginLeft: '20px', color: '#ffcc00' }}>Coins: {coins}</span>
      </div>
      <div className="night-mode-toggle" onClick={() => setIsNightMode(!isNightMode)}>
        {isNightMode ? '☀️' : '🌙'}
      </div>
      <div className="mute-toggle" onClick={() => setIsMuted(!isMuted)}>
        {isMuted ? '🔇' : '🔊'}
      </div>
      
      {visibleLanes.map((lane) => (
        <Lane
          key={lane.id} 
          type={lane.type} 
          obstacles={lane.obstacles} 
          bottom={lane.visualBottom}
          height={lane.height}
        />
      ))}
      
      <Player 
        x={player.x} 
        y={player.y} 
        size={100 / VISIBLE_ROWS}
        visualY={playerVisualY}
        colWidth={COL_WIDTH}
      />
      
      {gameOver && (
        <div className="game-over">
          <h1>GAME OVER</h1>
          <p>SCORE: {score * 10}</p>
          <p style={{ color: '#ffcc00', marginTop: '0' }}>COINS: {coins}</p>
          <button className="btn" onClick={() => {
            setGameOver(false);
            setScore(0);
            setCoins(0);
            setPlayer({ x: Math.floor(COLS / 2), y: 0 });
            setLanes({}); // Will trigger regeneration
          }}>RETRY</button>
        </div>
      )}
    </div>
  );
};

export default Game;
