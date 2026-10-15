import type { ModelAsset } from "./assetTypes";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("holobuild.assets", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("models", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        Error("Model storage unavailable. Allow IndexedDB storage and retry."),
      );
    request.onblocked = () =>
      reject(
        Error(
          "Model storage upgrade blocked. Close other HoloBuild tabs and retry.",
        ),
      );
  });
}
export async function storeAssets(assets: ModelAsset[]) {
  if (!assets.length) return;
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("models", "readwrite");
      for (const asset of assets) tx.objectStore("models").put(asset);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () =>
        reject(
          Error(
            "Could not store models. Check browser storage space/permissions.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function readAsset(id: string): Promise<ModelAsset | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("models", "readonly")
        .objectStore("models")
        .get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          Error(
            "Could not read stored model. Reload a self-contained project export.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
