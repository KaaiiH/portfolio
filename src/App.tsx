// src/App.tsx
import React, { useEffect, useRef, useCallback, useState } from 'react';
import './index.css';
import { ThreeScene } from './three/ThreeScene';

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [threeScene, setThreeScene] = useState<ThreeScene | null>(null);

  const handleObjectInteract = useCallback((objectName: string) => {
    if (objectName === 'ResumeCube') {
      window.open('public/assets/Hoenshell_resume.pdf', '_blank');
    } else if (objectName === 'GithubCube') {
      window.open('https://github.com/KaaiiH', '_blank');
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      const scene = new ThreeScene({
        canvas: canvasRef.current,
        onObjectInteract: handleObjectInteract,
      });
      scene.start();
      setThreeScene(scene);

      return () => {
        scene.stop();
      };
    } catch (error) {
      console.error('Error initializing ThreeScene:', error);
    }
  }, [handleObjectInteract]);

  useEffect(() => {
    const onResize = () => {
      if (threeScene) {
        threeScene.onWindowResize();
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [threeScene]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <canvas 
        ref={canvasRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          display: 'block'
        }} 
      />
      <div className="overlay">
        <h2>Kai Hoenshell Portfolio</h2>
        <p>Use W/A/S/D to move. Click on cubes to interact!</p>
        <p>Use Q to Sit/Stand</p>
        <p>Use Space to Jump</p>
        <p>Use E to Attack</p>
      </div>
    </div>
  );
}

export default App;
