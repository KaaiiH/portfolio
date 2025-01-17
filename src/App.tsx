// src/App.tsx
import React, { useEffect, useRef, useCallback, useState } from 'react';
import './index.css';
import { ThreeScene } from './three/ThreeScene';

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [threeScene, setThreeScene] = useState<ThreeScene | null>(null);

  const handleObjectInteract = useCallback((objectName: string) => {
    if (objectName === 'ResumeCube') {
      window.open('/assets/resume.pdf', '_blank');
    } else if (objectName === 'GithubCube') {
      window.open('https://github.com/your-username', '_blank');
    }
    //objects...
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new ThreeScene({
      canvas: canvasRef.current,
      onObjectInteract: handleObjectInteract,
    });
    scene.start();
    setThreeScene(scene);

    return () => {
      scene.stop();
    };
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
    <div style={{ position: 'relative' }}>
      <canvas ref={canvasRef} />
      <div className="overlay">
        <h2>My 3D Portfolio</h2>
        <p>Use W/A/S/D to move. Click on cubes to interact!</p>
      </div>
    </div>
  );
}

export default App;
