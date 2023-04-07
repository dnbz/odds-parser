export const processMatchData = (match, date) => {
    const mapping = {
        away_team_name: (s) => {
            // remove (Match) from the end of the string
            return s.replace(/\(Match\)/, '').trim();
        },
        home_team_name: (s) => {
            // remove (Match) from the end of the string
            return s.replace(/\(Match\)/, '').trim();
        },
        datetime: (s) => {
            // remove anything with brackets from the string
            return s.replace(/\(.*\)/, '').trim();
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
