export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <div id="game-container" className="w-full h-screen relative">
        <div id="flyToggle" className="absolute top-4 left-4 text-lg font-bold text-red-500">
          Spaceship Mode: LOCKED
        </div>
        <div className="absolute top-12 left-4 text-sm text-gray-300">
          Collect the cyan orb to unlock Spaceship Mode
        </div>
        <div className="absolute top-20 left-4 text-sm text-gray-300">
          Controls: WASD/Arrows to move, Space to ascend, Shift to descend
        </div>
      </div>
    </main>
  );
} 