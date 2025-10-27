
var SETTINGS = {
    fileName: "schedule.json",
    unknownPeriodName: "Unnamed period",
    newRoleValue: {
        senior: 850,
        junior: 340,
        course: 500,
    },
    newTaskValue: {
        senior: 340,
        junior: 80,
        course: 80,
    },
    valueToWidth: {
        base: 10,
        factor: 2,
        exponent: 0.75,
        minValue: 10,
        snapDelta: 10,
    },
    calculation: {
        person: (role, period) => {
            const percent = role.size[period];
            const hours = Math.round(1700 * percent / 100);
            if (percent) return ` → ${hours} h`;
        },
        course: (role, period) => {
            const students = role.size[period];
            const hours = Math.round(260 + 8 * students);
            if (students) return ` → ${hours} h`;
        },
    },
};
