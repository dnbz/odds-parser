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

// export const processMatchData = (match, date) => {
//   const mapping = {
//     away_team_name: (s) => {
//       return s.trim();
//     },
//     home_team_name: (s) => {
//       return s.trim();
//     },
//     datetime: (s) => {
//       return s.trim();
//     },
//     away_team: (s) => {
//       return Number(s);
//     },
//     draw: (s) => {
//       return Number(s);
//     },
//     home_team: (s) => {
//       return Number(s);
//     },
//   };
//
//   for (const [key, value] of Object.entries(match)) {
//     if (key in mapping) {
//       let func = mapping[key];
//       match[key] = func(value);
//     }
//   }
//
//   return match;
// };
