
var SETTINGS = {
    fileName: "schedule.json",
    unknownPeriodName: "Unnamed period",
    newRoleValue: {
        faculty: 850,
        postdoc: 340,
        phdstudent: 340,
        amanuens: 80,
        course: 500,
    },
    newTaskValue: {
        faculty: 340,
        postdoc: 100,
        phdstudent: 100,
        amanuens: 80,
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
            const percent = period ? role.size[period] : sum(Object.values(role.size));
            const hours = Math.round(1700 * percent / 100);
            if (percent) return ` → ${hours} h`;
        },
        course: (role, period) => {
            const students = period ? role.size[period] : sum(Object.values(role.size));
            const hours = Math.round(160 + 6 * students);
            if (students) return ` → ${hours} h`;
        },
    },
};
