
window.addEventListener("DOMContentLoaded", initialise);

function initialise() {
    setupImportExport();
    setupAddRole();
    setupPeriods();
    populateRolesAndTasks();
}


///////////////////////////////////////////////////////////////////////////////////////////////////
// Handling periods

function setupPeriods() {
    const periods = {};
    for (const roleId of dbRoleIds()) {
        for (p in dbGetRole(roleId).target) periods[p] = true;
    }
    const sortedPeriods = Object.keys(periods).toSorted((a,b) => -a.localeCompare(b));
    if (sortedPeriods.length === 0) {
        sortedPeriods.push(SETTINGS.unknownPeriodName);
    }
    const periodSelect = document.querySelector("#select-period select");
    for (const period of sortedPeriods) {
        periodSelect.appendChild(newElem("option", period, {value: period}));
    }
    periodSelect.appendChild(newElem("option", "────────────────────", {value: "%", disabled: true}));
    periodSelect.appendChild(newElem("option", "Rename this period", {value: "/"}));
    periodSelect.appendChild(newElem("option", "Add new empty period", {value: "+"}));
    periodSelect.appendChild(newElem("option", "Clone this period", {value: "="}));
    periodSelect.appendChild(newElem("option", "Delete this period", {value: "-"}));
    periodSelect.selectedIndex = 0;
    document.querySelector("#current-period").textContent = periodSelect.value;
    periodSelect.addEventListener("change", (event) => {
        const currentPeriod = getCurrentPeriod();
        let newPeriod = periodSelect.value;
        if (periodSelect.value === "/") {
            const newName = prompt("What is the new name of the period?");
            if (newName && sortedPeriods.includes(newName)) {
                alert(`The period ${newName} already exists.`);
            } else if (newName) {
                newPeriod = newName;
                renamePeriod(currentPeriod, newPeriod);
                const option = periodSelect.querySelector(`option[value="${currentPeriod}"]`);
                option.value = option.textContent = newPeriod;
            }
        } else if (periodSelect.value === "+" || periodSelect.value === "=") {
            newPeriod = prompt("What is the name of the new period?");
            if (newPeriod) {
                periodSelect.insertBefore(newElem("option", newPeriod, {value: newPeriod}), periodSelect.childNodes[0]);
                if (periodSelect.value === "=") {
                    clonePeriod(currentPeriod, newPeriod);
                }
            }
        } else if (periodSelect.value === "-") {
            newPeriod = currentPeriod;
            if (prompt(`Are you sure you want to delete ${currentPeriod}?\nIf so, type "YES":`) === "YES") {
                deletePeriod(currentPeriod);
                periodSelect.querySelector(`option[value="${currentPeriod}"]`).remove();
                newPeriod = periodSelect.childNodes[0].value;
                if (newPeriod === "%") {
                    newPeriod = SETTINGS.unknownPeriodName;
                    periodSelect.insertBefore(newElem("option", newPeriod, {value: newPeriod}), periodSelect.childNodes[0]);
                }
            }
        }
        periodSelect.querySelector(`option[value="${newPeriod}"]`).selected = true;
        document.querySelector("#current-period").textContent = periodSelect.value;
        populateRolesAndTasks();
    });
}


function getCurrentPeriod() {
    return document.querySelector("#current-period").textContent;
}


function renamePeriod(oldPeriod, newPeriod) {
    for (const roleId of dbRoleIds()) {
        const role = dbGetRole(roleId);
        if (oldPeriod in role.target) {
            role.target[newPeriod] = role.target[oldPeriod];
            delete role.target[oldPeriod];
            dbUpdateRole(roleId, role);
        }
    }
    for (const taskId of dbTaskIds()) {
        const task = dbGetTask(taskId);
        if (task.period === oldPeriod) {
            task.period = newPeriod;
            dbUpdateTask(taskId);
        }
    }
}


function deletePeriod(period) {
    for (const roleId of dbRoleIds()) {
        const role = dbGetRole(roleId);
        if (period in role.target) {
            delete role.target[period];
            if (Object.keys(role.target).length > 0) {
                dbUpdateRole(roleId, role);
            } else {
                dbDeleteRole(roleId);
            }
        }
    }
    for (const taskId of dbTaskIds()) {
        const task = dbGetTask(taskId);
        if (task.period === period) {
            dbDeleteTask(taskId);
        }
    }
}


function clonePeriod(fromPeriod, toPeriod) {
    for (const roleId of dbRoleIds()) {
        const role = dbGetRole(roleId);
        if (fromPeriod in role.target) {
            role.target[toPeriod] = role.target[fromPeriod];
        } else if (toPeriod in role.target) {
            delete role.target[toPeriod];
        } else {
            continue;
        }
        dbUpdateRole(roleId, role);
    }
    for (const taskId of dbTaskIds()) {
        if (dbGetTask(taskId).period === toPeriod) dbDeleteTask(taskId);
    }
    for (const taskId of dbTaskIds()) {
        const task = dbGetTask(taskId);
        if (task.period === fromPeriod) {
            const newTaskId = dbCreateTask(task);
            task.period = toPeriod;
            dbUpdateTask(newTaskId, task);
        }
    }
}


///////////////////////////////////////////////////////////////////////////////////////////////////
// Import, export

function setupImportExport() {
    const importElem = document.querySelector('#import-data input[type="file"]');
    importElem.addEventListener("change", importData);
    document.querySelector("#import-data button").addEventListener("click", () => importElem.click());
    const exportElem = document.querySelector("#export-data button");
    exportElem.addEventListener("click", exportData);
    exportElem.value = `Export data to "${SETTINGS.fileName}"`
}


function exportData() {
    const text = JSON.stringify(dbGetAllData(), null, 4);
    const href = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
    let elem = newElem("a", {href: href, download: SETTINGS.fileName, style: "display:none"});
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
}


function importData() {
    const fileInput = document.querySelector("#import-data input");
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
        const content = e.target.result;
        dbReplaceAllData(JSON.parse(content));
        window.location.reload();
    };
    fileReader.readAsText(fileInput.files[0]);
}


function cleanTasks() {
    const oldIds = dbTaskIds();
    const oldToNewIds = {}
    oldIds.forEach((oldId, newId) => {
        oldToNewIds[oldId] = newId;
    });
    document.querySelectorAll(".task").forEach((taskElem) => {
        taskElem.dataset.taskId = oldToNewIds[taskElem.dataset.taskId];
    });
    oldIds.forEach((oldId, newId) => {
        dbUpdateTask(newId, dbGetTask(oldId));
        dbDeleteTask(oldId);
    });
}


///////////////////////////////////////////////////////////////////////////////////////////////////
// Initialise the webpage

function populateRolesAndTasks() {
    for (const containerElem of document.querySelectorAll(".container")) {
        containerElem.replaceChildren();
    }
    const sortedIds = dbRoleIds();
    for (const roleId of sortedIds) {
        populateRole(roleId);
    }
    populateAddTaskDropdown(sortedIds);
    for (const taskId of dbTaskIds()) {
        populateTask(taskId, true);
    }
    updateRoles();
}


function populateRole(roleId) {
    const role = dbGetRole(roleId);
    const currentPeriod = getCurrentPeriod();
    if (role.target[currentPeriod] == null) return;

    const template = document.querySelector(`#${role.type}-template`);
    const roleElem = template.content.cloneNode(true).querySelector(".role");
    roleElem.dataset.role = roleId;
    if (role.group) roleElem.classList.add(role.group);
    roleElem.querySelector(".role-name").textContent = role.name;
    roleElem.querySelector(".role-name").title = (
        (role.nickname || role.name) +
        (role.comments ? "\n\n" + role.comments : "")
    );

    roleElem.querySelector(".edit-role")?.addEventListener("click", editRole);

    let containerElem;
    if (role.group) containerElem = document.querySelector(`.container[data-type="${role.type}"][data-group="${role.group}"]`);
    if (!containerElem) containerElem = document.querySelector(`.container[data-type="${role.type}"]`);
    containerElem.append(roleElem);

    // Drag and drop
    setupDraggableRole(roleElem, role.type);

    // Changing the total target value of a role
    const totalElem = roleElem.querySelector(".total-value");
    totalElem.addEventListener("change", (event) => {
        role.target[currentPeriod] = totalElem.value = parseInt(totalElem.value) || 0;
        dbUpdateRole(roleId, role);
        updateRoles(roleElem);
        totalElem.blur();
    });

    // Alt-clicking a <details> will open/close all sibling <details> too
    const summaryElem = roleElem.querySelector("summary");
    summaryElem.addEventListener("click", (event) => {
        if (event.altKey) {
            const isOpen = roleElem.open;
            roleElem.closest(".container").querySelectorAll(".role").forEach((elem) => {
                if (isOpen) elem.removeAttribute("open");
                else elem.setAttribute("open", true)
            });
            event.preventDefault();
        }
    });
}


function populateAddTaskDropdown(sortedIds) {
    // TODO: This only works if there are two types.
    // If there are more, then the new tasks will miss to include a role.
    const currentPeriod = getCurrentPeriod();
    for (const addElem of document.querySelectorAll(`select.add-task`)) {
        addElem.replaceChildren();
        addElem.appendChild(newElem("option", "+", {disabled: true, selected: true}));
        const group = addElem.dataset.group;
        for (const roleId of sortedIds) {
            const role = dbGetRole(roleId);
            if (currentPeriod in role.target) {
                if (group === role.group || group === role.type) {
                    addElem.appendChild(newElem("option", role.name, {value: role.type + ":" + roleId}));
                }
            }
        }

        const otherId = addElem.closest(".role").dataset.role;
        const other = dbGetRole(otherId);
        const newValue = SETTINGS.newTaskValue[other.group] || SETTINGS.newTaskValue[other.type];
        addElem.addEventListener("change", (event) => {
            const [roleType, roleId] = addElem.value.split(":");
            const task = {
                roles: {
                    [roleType]: roleId,
                    [other.type]: otherId,
                },
                period: getCurrentPeriod(),
                value: newValue,
            };
            const taskId = dbCreateTask(task);
            populateTask(taskId);
            addElem.selectedIndex = 0;
            addElem.blur();
        })
    }
}


function populateTask(taskId, dontUpdateRoles = false) {
    const currentPeriod = getCurrentPeriod();
    const task = dbGetTask(taskId);
    if (task.period !== currentPeriod) return;
    const roleElems = {};
    const taskListSelectors = [];
    for (const type in task.roles) {
        const roleElem = document.querySelector(`.role[data-role="${task.roles[type]}"]`);
        if (!roleElem) continue;
        roleElems[type] = roleElem;
        const group = dbGetRole(roleElem.dataset.role).group;
        if (group) taskListSelectors.push(`.${group} > .tasklist`);
    }
    taskListSelectors.push(".tasklist"); // Catch-all, if no group tasklist is found below

    for (const type in roleElems) {
        const taskElem = newElem(
            "div", {class: "task", draggable: "true"},
            newElem("span", {class: "task-value"}),
            newElem("span", {class: "task-info"}),
        );

        taskElem.dataset.taskId = taskId;

        let tasklistElem, tasklistSelector;
        for (tasklistSelector of taskListSelectors) {
            tasklistElem = roleElems[type].querySelector(tasklistSelector);
            if (tasklistElem) break;
        }
        tasklistElem.append(taskElem);

        // Editing, removing
        taskElem.addEventListener("dblclick", editTask);
        // taskElem.addEventListener("contextmenu", editTask);

        // Drag and drop
        setupDraggableTask(taskElem, type, tasklistSelector);

        // Resizing
        new ResizeObserver(debounce((entries) => {
            for (const entry of entries) {
                if (entry.target !== taskElem) continue;
                const width = entry.contentRect.width;
                if (width && width > 0) {
                    const newValue = widthToValue(width);
                    if (newValue !== task.value) {
                        task.value = newValue;
                        dbUpdateTask(taskId, task);
                        updateTask(taskId);
                    }
                }
                updateRoles(...Object.values(roleElems));
            }
        })).observe(taskElem);
    }

    updateTask(taskId);
    if (!dontUpdateRoles)
        updateRoles(...Object.values(roleElems));
}


///////////////////////////////////////////////////////////////////////////////////////////////////
// Handling tasks

function deleteTask(taskId) {
    const roleElems = [];
    for (const taskElem of document.querySelectorAll(`.task[data-task-id="${taskId}"]`)) {
        roleElems.push(taskElem.closest(".role"));
        taskElem.remove();
    }
    updateRoles(...roleElems);
    dbDeleteTask(taskId);
}


function editTask(event) {
    event.preventDefault();
    const taskElem = event.target.closest(".task");
    showTaskEditor(taskElem);
}


function showTaskEditor(taskElem) {
    const taskId = taskElem.dataset.taskId;
    const task = dbGetTask(taskId);
    const taskInfo = taskElem.querySelector(".task-info").textContent;

    const taskEditor = document.querySelector("#edit-task-dialog");
    taskEditor.querySelector(".edit-task-id").textContent = taskId;

    const form = taskEditor.querySelector("form");
    form.querySelectorAll("select").forEach((elem) => elem.replaceChildren());
    for (const roleId of dbRoleIds()) {
        const role = dbGetRole(roleId);
        const selectElem = form.elements[role.type];
        selectElem.appendChild(
            newElem("option", role.name, {value: roleId})
        );
        if (task.roles[role.type] === roleId) selectElem.lastChild.selected = true;
    }
    form.elements.value.value = task.value || 0;
    form.elements.comments.value = task.comments || "";

    function handleEdits() {
        if (taskEditor.returnValue === "ok") {
            const updated = {
                value: parseFloat(form.elements.value.value),
                comments: form.elements.comments.value,
                period: task.period,
                roles: {},
            };
            for (const type in task.roles) {
                updated.roles[type] = form.elements[type].value;
            }
            if (JSON.stringify(updated) !== JSON.stringify(task)) {
                dbUpdateTask(taskId, updated);
                populateRolesAndTasks();
            }
        } else if (taskEditor.returnValue === "delete") {
            if (confirm(`Do you want to delete the task "${taskInfo}"?`)) {
                deleteTask(taskElem.dataset.taskId);
            }
        }
    }
    taskEditor.addEventListener("close", handleEdits, {once: true});
    taskEditor.showModal();
}


function updateTask(taskId) {
    const task = dbGetTask(taskId);
    if (!task) return;
    const taskElems = document.querySelectorAll(`.task[data-task-id="${taskId}"]`);
    for (const taskElem of taskElems) {
        const roleId = taskElem.closest(".role").dataset.role;
        const taskRoles = Object.keys(task.roles).flatMap((type) =>
            (task.roles[type] !== roleId) ? dbGetRole(task.roles[type]) : []
        );
        if (taskRoles.length === 0) console.warn(`Task ${taskId} in ${roleId}: empty description`, task);
        taskElem.querySelector(".task-value").textContent = task.value;
        taskElem.querySelector(".task-info").textContent = taskRoles.map((r) => r.nickname || r.name).join(" + ");
        taskElem.title = (
            task.value + ": " + taskRoles.map((r) => r.name).join(" + ") +
            (task.comments ? "\n\n" + task.comments : "")
        );
        const width = valueToWidth(task.value);
        taskElem.style.width = width + "px";
    }
}


///////////////////////////////////////////////////////////////////////////////////////////////////
// Handling roles

function setupAddRole() {
    for (const elem of document.querySelectorAll("select.add-role")) {
        const type = elem.dataset.type;
        for (const roleId of dbRoleIds()) {
            const role = dbGetRole(roleId);
            if (role.type === type) {
                let optgroup = elem.querySelector(`optgroup[data-group="${role.group}"]`);
                if (!optgroup) optgroup = elem;
                optgroup.appendChild(newElem("option", role.name, {value: roleId}));
            }
        }
        elem.selectedIndex = 0;
        elem.addEventListener("focus", filterAddSelect);
        elem.addEventListener("change", addNewRole);
    }
}


function filterAddSelect(event) {
    const selectElem = event.target;
    for (const optElem of selectElem.querySelectorAll("option")) {
        const roleId = optElem.value;
        optElem.style.display = document.querySelector(`.role[data-role="${roleId}"]`) ? "none" : "inherit";
    }
}


function addNewRole(event) {
    const selectElem = event.target;
    if (selectElem.value === "+") {
        const roleId = "role-" + Math.floor((Math.random() + 1) * 1e10).toString(36);
        showRoleEditor(roleId, {type: selectElem.dataset.type, target: {}});
    } else {
        const roleId = selectElem.value;
        const role = dbGetRole(roleId);
        const currentPeriod = getCurrentPeriod();
        if (role.target[currentPeriod] != null) {
            console.error(`New role ${roleId} already contains the current period.`);
            return;
        }
        const newTarget = SETTINGS.newRoleValue[role.group] || SETTINGS.newRoleValue[role.type];
        role.target[currentPeriod] = newTarget;
        dbUpdateRole(roleId, role);
        populateRolesAndTasks();
    }
    selectElem.selectedIndex = 0;
    selectElem.blur();
}


function editRole(event) {
    event.preventDefault();
    const roleId = event.target.closest(".role").dataset.role;
    showRoleEditor(roleId, dbGetRole(roleId));
}


function showRoleEditor(roleId, role) {
    const roleEditor = document.querySelector(`#edit-dialog-${role.type}`);
    roleEditor.querySelector(".edit-role-id").textContent = roleId;
    const period = getCurrentPeriod();

    const form = roleEditor.querySelector("form");
    form.elements.name.value = role.name || "";
    form.elements.nickname.value = role.nickname || "";
    form.elements.group.value = role.group || "";
    form.elements.comments.value = role.comments || "";
    form.elements.target.value = role.target[period] || 0;

    function handleEdits() {
        if (roleEditor.returnValue === "ok") {
            const newTarget = parseFloat(form.elements.target.value);
            const updated = {
                type: role.type,
                name: form.elements.name.value,
                nickname: form.elements.nickname.value,
                group: form.elements.group.value,
                comments: form.elements.comments.value,
                target: Object.assign({}, role.target, {[period]: newTarget}),
            };
            if (JSON.stringify(updated) !== JSON.stringify(role)) {
                dbUpdateRole(roleId, updated);
                populateRolesAndTasks();
                document.querySelector(`.role[data-role="${roleId}"]`).scrollIntoView({block: "center", inline: "center"});
            }
        } else if (roleEditor.returnValue === "delete") {
            const populated = dbTaskIds().some((id) => {
                const task = dbGetTask(id);
                return task.period === period && task.roles[role.type] === roleId;
            });
            if (populated) {
                alert("You have to remove all tasks before you can remove the role");
            } else if (confirm(`Are you certain you want to remove role ${role.name}?`)) {
                delete role.target[period];
                if (Object.keys(role.target).length === 0) {
                dbDeleteRole(roleId);
                } else {
                    dbUpdateRole(roleId, role);
                }
                populateRolesAndTasks();
            }
        }
    }
    roleEditor.addEventListener("close", handleEdits, {once: true});
    roleEditor.showModal();
}


function updateRoles(...roleElems) {
    const period = getCurrentPeriod();
    if (roleElems.length === 0)
        roleElems = document.querySelectorAll(".role");
    for (const roleElem of roleElems) {
        const roleId = roleElem.dataset.role;
        const role = dbGetRole(roleId);
        if (!role) continue;
        const totalElem = roleElem.querySelector(".total-value");
        const totalValue = totalElem.value = role.target[getCurrentPeriod()];
        const usedValueElem = roleElem.querySelector(".used-value-text");
        const usedSliderElem = roleElem.querySelector(".used-value-slider");
        let usedValue = 0;
        for (const taskId of dbTaskIds()) {
            const task = dbGetTask(taskId);
            if (task?.period === period && task?.roles?.[role.type] === roleId) usedValue += task.value;
        }
        const usedPercent = totalValue <= 0 ? 0 : Math.round(100 * usedValue / totalValue);
        usedSliderElem.style.width = (usedPercent / 2) + "%";
        usedValueElem.textContent = displaySign(Math.round(usedValue - totalValue));
    }
}


///////////////////////////////////////////////////////////////////////////////////////////////////
// Drag and drop

const DRAG_DROP_DATA = {type: null, tasklistSelector: null};


function setupDraggableTask(taskElem, type, tasklistSelector) {
    // Dragging
    taskElem.addEventListener("dragstart", (event) => {
        taskElem.classList.add("dragged");
        event.dataTransfer.effectAllowed = "move";
        // Only allow dragging within the same type
        DRAG_DROP_DATA.type = type;
        DRAG_DROP_DATA.tasklistSelector = tasklistSelector;
    });
    taskElem.addEventListener("dragend", (event) => {
        taskElem.classList.remove("dragged");
    });
}


function setupDraggableRole(roleElem, type) {
    roleElem.addEventListener("dragover", (event) => {
        // Only allow dragging within the same type
        if (DRAG_DROP_DATA.type !== type) return;
        movePlaceholder(event);
    });
    roleElem.addEventListener("dragleave", (event) => {
        // If we are moving into a child element, we aren't actually leaving the column
        if (roleElem.contains(event.relatedTarget)) return;
        const placeholderElem = document.querySelector(".placeholder");
        placeholderElem?.remove();
    });
    roleElem.addEventListener("drop", (event) => {
        event.preventDefault();
        const draggedElem = document.querySelector(".dragged");
        const placeholderElem = document.querySelector(".placeholder");
        if (!placeholderElem) return;
        const oldRoleElem = draggedElem.closest(".role");
        draggedElem.remove();
        const tasklistSelector = DRAG_DROP_DATA.tasklistSelector;
        roleElem.querySelector(tasklistSelector).insertBefore(draggedElem, placeholderElem);
        placeholderElem.remove();
        const newRoleElem = draggedElem.closest(".role");
        const roleId = newRoleElem.dataset.role;
        const taskId = draggedElem.dataset.taskId;
        const task = dbGetTask(taskId);
        task.roles[type] = roleId;
        dbUpdateTask(taskId, task);
        updateTask(taskId);
        updateRoles(oldRoleElem, newRoleElem);
        DRAG_DROP_DATA.type = DRAG_DROP_DATA.tasklistSelector = null;
    });

}

function movePlaceholder(event) {
    event.preventDefault();
    const roleElem = event.currentTarget;
    const draggedElem = document.querySelector(".dragged");
    const makePlaceholder = () => newElem(
        "span", draggedElem.textContent, {class: "placeholder", style: `width:${draggedElem.offsetWidth}px`}
    );

    const tasklistSelector = DRAG_DROP_DATA.tasklistSelector;
    if (!tasklistSelector) return;
    const tasklistElem = roleElem.querySelector(tasklistSelector);
    const placeholderElem = roleElem.querySelector(".placeholder");
    if (placeholderElem) {
        const placeholderRect = placeholderElem.getBoundingClientRect();
        if (placeholderRect.left <= event.clientX && event.clientX <= placeholderRect.right)
            return;
    }
    for (const taskElem of tasklistElem.children) {
        if (event.clientX <= taskElem.getBoundingClientRect().right) {
            if (taskElem === placeholderElem) return;
            placeholderElem?.remove();
            if (taskElem === draggedElem || taskElem.previousElementSibling === draggedElem)
                return;
            tasklistElem.insertBefore(
                placeholderElem ?? makePlaceholder(),
                taskElem,
            );
            return;
        }
    }
    placeholderElem?.remove();
    if (tasklistElem.lastElementChild === draggedElem) return;
    tasklistElem.append(placeholderElem ?? makePlaceholder());
}


///////////////////////////////////////////////////////////////////////////////////////////////////
// Utilities

function newElem(tag, ...args) {
    const elem = document.createElement(tag);
    for (const arg of args) {
        if (typeof arg !== "object" || arg instanceof Element) {
            elem.append(arg);
        } else {
            for (const key in arg) elem.setAttribute(key, arg[key]);
        }
    }
    return elem;
}


function debounce(func) {
    const debounceTimeout = 20;
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, debounceTimeout);
    };
}


function displaySign(number) {
    return (number > 0 ? "+" : number < 0 ? "–" : "±") + Math.abs(number);
}


function valueToWidth(value) {
    const v2w = SETTINGS.valueToWidth;
    return Math.round((value ** v2w.exponent) * v2w.factor + v2w.base);
}

function widthToValue(width) {
    const v2w = SETTINGS.valueToWidth;
    return Math.max(v2w.minValue, snapToGrid(((width - v2w.base) / v2w.factor) ** (1 / v2w.exponent)));
}

function snapToGrid(value) {
    const v2w = SETTINGS.valueToWidth;
    return Math.round(value / v2w.snapDelta) * v2w.snapDelta;
}


///////////////////////////////////////////////////////////////////////////////////////////////////
// Database

function dbClearDatabase() {
    localStorage.clear();
}

function dbReplaceAllData(data) {
    dbClearDatabase();
    for (const roleId in data.roles) dbUpdateRole(roleId, data.roles[roleId]);
    for (const taskId in data.tasks) dbUpdateTask(taskId, data.tasks[taskId]);
}

function dbGetAllData() {
    const data = {roles: {}, tasks: {}};
    for (const roleId of dbRoleIds()) data.roles[roleId] = dbGetRole(roleId);
    for (const taskId of dbTaskIds()) data.tasks[taskId] = dbGetTask(taskId);
    return data;
}

function dbRoleIds() {
    const roleIds = [];
    for (let i = 0; i < localStorage.length; i++){
        let id = localStorage.key(i);
        if (id[0] === "#") {
            id = id.slice(1);
            roleIds.push([id, dbGetRole(id).name]);
        }
    }
    return roleIds.toSorted((a,b) => a[1].localeCompare(b[1])).map((a) => a[0]);
}

function dbHasRole(roleId) {
    return dbGetRole(roleId);
}

function dbGetRole(roleId) {
    const jsonRole = localStorage.getItem("#" + roleId);
    return jsonRole && JSON.parse(jsonRole);
}

function dbUpdateRole(roleId, role) {
    localStorage.setItem("#" + roleId, JSON.stringify(role));
}

function dbDeleteRole(roleId) {
    localStorage.removeItem("#" + roleId);
}

function dbTaskIds() {
    const taskIds = [];
    for (let i = 0; i < localStorage.length; i++){
        const id = localStorage.key(i);
        if (id[0] === ":") taskIds.push(parseInt(id.slice(1)));
    }
    return taskIds.toSorted((a,b) => a - b);
}

function dbCreateTask(task) {
    const taskId = Math.max(0, ...dbTaskIds()) + 1;
    dbUpdateTask(taskId, task);
    return taskId;
}

function dbHasTask(taskId) {
    return dbGetTask(taskId);
}

function dbGetTask(taskId) {
    const jsonTask = localStorage.getItem(":" + taskId);
    return jsonTask && JSON.parse(jsonTask);
}

function dbUpdateTask(taskId, task) {
    localStorage.setItem(":" + taskId, JSON.stringify(task));
}

function dbDeleteTask(taskId) {
    localStorage.removeItem(":" + taskId);
}
