import { useRef, useState } from "react";
import { FileBox, ArchiveRestore } from "lucide-react";
import { createCube } from "../../scene/objectFactory";
import { execute } from "../../scene/commandManager";
import { useSceneStore } from "../../scene/sceneStore";
import { importFiles, pruneModelResources } from "../../assets/modelRegistry";
import { loadProject } from "../../assets/projectIO";
export function ModelImport({ compact }: { compact: boolean }) {
  const objects = useSceneStore((s) => s.objects);
  const models = objects.filter((o) => o.model);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="model-import">
      {!compact && models.length > 0 && (
        <div className="imported-assets" aria-label="Imported assets in scene">
          {[...new Set(models.map((o) => o.model!.assetId))].map((id) => {
            const instances = models.filter((o) => o.model!.assetId === id);
            return (
              <button
                key={id}
                title={`Select ${instances[0].name}`}
                onClick={() => useSceneStore.getState().select(instances[0].id)}
              >
                {instances[0].name} · {instances.length} instance
                {instances.length === 1 ? "" : "s"}
              </button>
            );
          })}
        </div>
      )}
      <button
        aria-label="Import 3D Model"
        title="Import GLB/GLTF (10 MiB including dependencies)"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <FileBox size={18} />
        {!compact && <span>{busy ? "Loading model…" : "Import 3D Model"}</span>}
      </button>
      {!compact && (
        <p className="muted">
          GLB / GLTF · 10 MiB. Select BIN/images with the GLTF. Models fit a 2 m
          envelope.
        </p>
      )}
      <input
        ref={input}
        hidden
        aria-label="Model files"
        type="file"
        multiple
        accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!files.length || busy) return;
          setBusy(true);
          useSceneStore.setState({
            status: "Loading model and local dependencies…",
          });
          try {
            const { asset, resource } = await importFiles(files);
            const object = {
              ...createCube(),
              type: "model" as const,
              name:
                asset.main.replace(/\.(glb|gltf)$/i, "").slice(0, 60) ||
                "Imported model",
              position: [0, resource.size[1] / 2, 0] as [
                number,
                number,
                number,
              ],
              model: {
                assetId: asset.id,
                size: resource.size,
                originalMaterials: true,
              },
            };
            if (execute({ type: "import", object }))
              useSceneStore.setState({
                status: `Imported ${asset.main}: ${resource.triangles.toLocaleString()} triangles. Asset stored locally; Save project exports all model data.`,
              });
          } catch (error) {
            useSceneStore.setState({
              status: `Model import failed: ${error instanceof Error ? error.message : "Invalid model."}`,
            });
          } finally {
            pruneModelResources();
            setBusy(false);
          }
        }}
      />
      <button
        title="Restore last locally saved project"
        aria-label="Restore local project"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const json = localStorage.getItem("holobuild.scene");
            if (!json) throw Error("No local save found.");
            await loadProject(json);
            useSceneStore.setState({
              status: "Restored local project and stored assets.",
            });
          } catch (error) {
            useSceneStore.setState({
              status: `Could not restore: ${error instanceof Error ? error.message : "Storage unavailable."}`,
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        <ArchiveRestore size={17} />
        {!compact && <span>Restore local project</span>}
      </button>
    </div>
  );
}
