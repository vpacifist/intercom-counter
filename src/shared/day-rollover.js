export function getNextLocalDayStart(input = Date.now()) {
  const now = new Date(input);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
}

