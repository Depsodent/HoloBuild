// Ollama's constrained decoder expects homogeneous `items`, not tuple items:false.
// This projection guides decoding only. The original Zod schema still validates every result.
export function providerSchema(value) {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (!value || typeof value !== "object") return value;
  const result = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, providerSchema(item)]),
  );
  const tuple =
    value.prefixItems ?? (Array.isArray(value.items) ? value.items : null);
  if (tuple) {
    const same = tuple.every(
      (item) => JSON.stringify(item) === JSON.stringify(tuple[0]),
    );
    const types = [...new Set(tuple.map((item) => item.type))];
    result.items = same
      ? providerSchema(tuple[0])
      : types.length === 1
        ? { type: types[0] }
        : { anyOf: tuple.map(providerSchema) };
    result.minItems = result.maxItems = tuple.length;
    delete result.prefixItems;
    delete result.additionalItems;
  }
  return result;
}
