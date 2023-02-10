export const processMatchData = (match, date) => {
    const mapping = {
        away_team_name: (s) => {
            return s.trim();
        },
        home_team_name: (s) => {
            return s.trim();
        },
        datetime: (s) => {
            return s.trim();
        },
        away_team: (s) => {
            return Number(s);
        },
        draw: (s) => {
            return Number(s);
        },
        home_team: (s) => {
            return Number(s);
        },
    };

    for (const [key, value] of Object.entries(match)) {
        if (key in mapping) {
            let func = mapping[key];
            match[key] = func(value);
        }
    }

    return match;
};
