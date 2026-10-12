export function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[4, 8, 6]}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-5, 3, -3]} intensity={15} color="#7c6afa" />
    </>
  );
}
