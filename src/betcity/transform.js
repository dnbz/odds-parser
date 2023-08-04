export const processMatchData = (obj) => {
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      let value = obj[key];
      if (typeof value === "string") {
        obj[key] = value.trim();
      } else if (
        typeof value === "object" &&
        value !== null &&
        !(value instanceof Date) &&
        !(value instanceof RegExp)
      ) {
        processMatchData(value);
      }
    }
  }
  return obj;
};
