let busy = false;
export async function assetOperation<T>(action: () => Promise<T>): Promise<T> {
  if (busy)
    throw Error(
      "Another model import or project load is running. Wait for it to finish.",
    );
  busy = true;
  try {
    return await action();
  } finally {
    busy = false;
  }
}
