function keysOf(path: string) {
  return path.split(".").filter(Boolean);
}

export function getAtPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const key of keysOf(path)) {
    if (Array.isArray(current)) {
      current = current[Number(key)];
    } else if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function setIn(current: unknown, keys: string[], value: unknown): unknown {
  if (!keys.length) return value;
  const [key, ...rest] = keys;
  if (Array.isArray(current)) {
    const copy = current.slice();
    const index = Number(key);
    copy[index] = setIn(copy[index], rest, value);
    return copy;
  }
  const object = current && typeof current === "object" ? (current as Record<string, unknown>) : {};
  return { ...object, [key]: setIn(object[key], rest, value) };
}

export function setAtPath<T>(root: T, path: string, value: unknown): T {
  return setIn(root, keysOf(path), value) as T;
}

export function arrayAtPath(root: unknown, path: string): unknown[] {
  const value = getAtPath(root, path);
  return Array.isArray(value) ? value : [];
}

export function pushAtPath<T>(root: T, path: string, item: unknown): T {
  const list = arrayAtPath(root, path);
  return setAtPath(root, path, [...list, item]);
}

export function removeAtPath<T>(root: T, path: string, index: number): T {
  const list = arrayAtPath(root, path);
  return setAtPath(root, path, list.filter((_, itemIndex) => itemIndex !== index));
}

export function moveAtPath<T>(root: T, path: string, index: number, direction: -1 | 1): T {
  const list = [...arrayAtPath(root, path)];
  const target = index + direction;
  if (target < 0 || target >= list.length) return root;
  [list[index], list[target]] = [list[target], list[index]];
  return setAtPath(root, path, list);
}
