//     V6 - Dark Mode - Sicherheitsabfrage Kategorien Fix
//     Initialisierung & Daten-Speicher
// 

const KEY = "meinBudget_v6";
let state = loadState();

// Globaler Merker für die Dialoge
let expenseIdToDelete = null;
let catIndexToDelete = null; // Merker für das Kategorie-Lösch-Popup

// DOM-Elemente einmalig cachen für maximale Render-Performance
const DOM = {
    periodLabel: null, remaining: null, daily: null, weekly: null, days: null,
    budgetValue: null, spentValue: null, progressBar: null,
    statsList: null, statsChart: null, statsTotal: null,
    expensesList: null, budgetInput: null, budgetDialog: null,
    budgetForm: null, expenseForm: null, expenseAmount: null,
    expenseId: null, expenseCategory: null, expenseNote: null,
    expenseDialog: null, expenseTitle: null, settingsDialog: null,
    startDayInput: null, settingsBtn: null, directExportBtn: null, 
    directImportBtn: null, exportToast: null,
    themeSelect: null,
    exportSuccessDialog: null, closeExportSuccessBtn: null,
    importDataDialog: null, importCodeInput: null, confirmImportBtn: null, cancelImportBtn: null,
    addBtn: null, deleteConfirmDialog: null, confirmDeleteBtn: null, cancelDeleteBtn: null,
    
    // Zuweisungen für das Kategorielayout im HTML
    settingsCategoryList: null,
    newCategoryInput: null,
    addCategoryBtn: null,
    
    // Neue Variablen für die Sicherheitsabfrage
    deleteCategoryDialog: null,
    deleteCategoryWarningText: null,
    cancelDeleteCatBtn: null,
    confirmDeleteCatBtn: null
};

// Hilfsfunktion zur einfachen Element-Zuweisung
const $ = id => document.getElementById(id);

// Fallback-Emoji-Liste, falls der Nutzer ein Wort ohne Emoji eingibt
const DEFAULT_EMOJIS = {
    "Lebensmittel": "🛒", "Drogerie": "🧼", "Haushalt": "🏡", 
    "Kleidung": "👗", "Freizeit": "🛍", "Auto": "🚗", 
    "Gesundheit": "🩺", "Sonstiges": "✨"
};

function getCategoryEmoji(catName) {
    const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
    if (emojiRegex.test(catName)) return ""; 
    return DEFAULT_EMOJIS[catName] || "🏷️"; 
}

/* ==========================================================================
   1. DATEN LADEN & INITIALISIEREN (ABGESICHERT)
   ========================================================================= */
function loadState() {
    const defaultCategories = ["Lebensmittel", "Drogerie", "Haushalt", "Kleidung", "Freizeit", "Auto", "Gesundheit", "Tabakwaren", "Sonstiges"];
    try {
        let currentSaved = localStorage.getItem(KEY);
        if (currentSaved) {
            let parsed = JSON.parse(currentSaved);
            if (parsed && parsed.budgets && Array.isArray(parsed.expenses)) {
                if (!parsed.startDay) parsed.startDay = 24;
                if (!parsed.theme) parsed.theme = "light";
                if (!parsed.categories || !Array.isArray(parsed.categories)) parsed.categories = defaultCategories;
                return parsed;
            }
        }

        for (const version of ["_v5", "_v3", "_v2", "_v1"]) {
            const savedData = localStorage.getItem(KEY.replace("_v5", version));
            if (savedData) {
                const parsed = JSON.parse(savedData);
                if (parsed && parsed.budgets && Array.isArray(parsed.expenses)) {
                    if (!parsed.startDay) parsed.startDay = 24;
                    if (!parsed.theme) parsed.theme = "light";
                    parsed.categories = defaultCategories;
                    return parsed;
                }
            }
        }
    } catch (e) {
        console.error("Fehler beim Laden der Daten:", e);
    }
    
    return { 
        period: "month", 
        startDay: 24, 
        theme: "light", 
        budgets: {}, 
        expenses: [],
        categories: defaultCategories
    };
}

function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
        return true;
    } catch (e) {
        alert("Die Daten konnten auf diesem Gerät nicht gespeichert werden.");
        return false;
    }
}

/* ==========================================================================
   THEME-LOGIK (DARK MODE)
   ========================================================================= */
function applyTheme() {
    const theme = state.theme || "light";
    if (DOM.themeSelect) DOM.themeSelect.value = theme;

    if (theme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
    } else if (theme === "light") {
        document.documentElement.setAttribute("data-theme", "light");
    } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }
}
/* ==========================================================================
   2. HILFSFUNKTIONEN & ZEITRAUM-BERECHNUNG
   ========================================================================= */
const euro = n => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
const pad = n => String(n).padStart(2, "0");
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const esc = s => String(s || "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const newId = () => `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;


function previousBankDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);

    // Wochenenden überspringen
    while (x.getDay() === 0 || x.getDay() === 6) {
        x.setDate(x.getDate() - 1);
    }

    // Gesetzliche Feiertage in Niedersachsen
    const holidays = new Set([
        "01-01", "05-01", "10-03", "10-31",
        "12-25", "12-26"
    ]);

    // Bewegliche Feiertage: Ostern und davon abhängige Tage
    const year = x.getFullYear();
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d1 = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d1 - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const easter = new Date(year, month - 1, day);

    const movable = [-2, 1, 39, 50];
    for (const offset of movable) {
        const holiday = new Date(easter);
        holiday.setDate(holiday.getDate() + offset);
        holidays.add(
            `${String(holiday.getMonth() + 1).padStart(2, "0")}-${String(holiday.getDate()).padStart(2, "0")}`
        );
    }

    while (
        x.getDay() === 0 ||
        x.getDay() === 6 ||
        holidays.has(
            `${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
        )
    ) {
        x.setDate(x.getDate() - 1);
    }

    return x;
}

function getPeriod() {
    const now = new Date();
    const startDay = state?.startDay || 24;

    let target = new Date(
        now.getFullYear(),
        now.getMonth(),
        startDay,
        0, 0, 0, 0
    );

    if (now < target) {
        target.setMonth(target.getMonth() - 1);
    }

    const start = previousBankDay(target);

    let endTarget = new Date(
        target.getFullYear(),
        target.getMonth() + 1,
        startDay
    );
    endTarget.setDate(endTarget.getDate() - 1);

    const end = new Date(
        endTarget.getFullYear(),
        endTarget.getMonth(),
        endTarget.getDate(),
        23, 59, 59, 999
    );

    return {
        key: `p_${dateKey(start)}`,
        start,
        end,
        label: `${start.toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit"
        })} – ${end.toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        })}`
    };
}


function inPeriod(expense, p) {
    if (!expense.date) return false;
    const d = new Date(expense.date);
    d.setHours(0, 0, 0, 0); 
    return d >= p.start && d <= p.end;
}

/* ==========================================================================
   3. DYNAMISCHE KATEGORIE-LISTEN (RENDER-LOGIK)
   ========================================================================= */
function renderCategorySelect() {
    if (!DOM.expenseCategory) return;
    const categories = state.categories || ["Lebensmittel", "Drogerie", "Haushalt", "Kleidung", "Freizeit", "Auto", "Gesundheit", "Tabakwaren", "Sonstiges"];
    
    DOM.expenseCategory.innerHTML = "";
    DOM.expenseCategory.innerHTML = categories.map(cat => {
        const emoji = getCategoryEmoji(cat);
        const displayName = emoji ? `${emoji} ${cat}` : cat;
        return `<option value="${esc(cat)}">${esc(displayName)}</option>`;
    }).join("");
}
function renderSettingsCategories() {
    if (!DOM.settingsCategoryList) return;
    const categories = state.categories || ["Lebensmittel", "Drogerie", "Haushalt", "Kleidung", "Freizeit", "Auto", "Gesundheit", "Tabakwaren", "Sonstiges"];
    
    DOM.settingsCategoryList.innerHTML = categories.map((cat, index) => {
        const emoji = getCategoryEmoji(cat);
        const displayName = emoji ? `${emoji} ${cat}` : cat;
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 4px; border-bottom: 0.5px solid #dcdcd8; font-size: 15px;">
                <span>${esc(displayName)}</span>
                <button type="button" class="delete-cat-btn" data-index="${index}" style="background: transparent; border: 0; color: #ff3b30; cursor: pointer; font-size: 14px; padding: 2px 6px;">✕</button>
            </div>
        `;
    }).join("");

    DOM.settingsCategoryList.querySelectorAll(".delete-cat-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const index = parseInt(e.target.getAttribute("data-index"), 10);
            if (!state.categories || !state.categories[index]) return;
            
            const catName = state.categories[index];
            const p = getPeriod();
            
            // Prüft blitzschnell, ob es im aktuellen Monat Ausgaben mit dieser Kategorie gibt
            const hasActiveExpenses = state.expenses.some(x => x.category === catName && inPeriod(x, p));

            if (hasActiveExpenses) {
                catIndexToDelete = index; // Merker für finalen Lösch-Knopf setzen
                
                if (DOM.deleteCategoryWarningText) {
                    DOM.deleteCategoryWarningText.innerHTML = `Du hast in diesem Zeitraum bereits Ausgaben auf die Kategorie <strong>${esc(catName)}</strong> gebucht.<br><br>Möchtest du sie trotzdem aus der zukünftigen Auswahl entfernen?`;
                }
                DOM.deleteCategoryDialog?.showModal();
            } else {
                // Keine Ausgaben gefunden? Direkt löschen!
                state.categories.splice(index, 1);
                if (save()) {
                    renderSettingsCategories();
                    renderCategorySelect();
                    render();
                }
            }
        });
    });
}

/* ==========================================================================
   4. ANZEIGE (HAUPT-RENDER-FUNKTION FÜR UI & STATISTIK)
   ========================================================================== */
function render() {
    const p = getPeriod();
    const expenses = state.expenses.filter(x => inPeriod(x, p));
    const spent = expenses.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
    const budget = Number(state.budgets[p.key] || 0);
    const remaining = budget - spent;
    const now = new Date();
    const days = Math.max(1, Math.ceil((p.end - now) / 86400000));

    if (DOM.periodLabel) DOM.periodLabel.textContent = `Zeitraum: ${p.label}`;
    if (DOM.daily) DOM.daily.textContent = euro(Math.max(0, remaining / days));

    if (DOM.weekly) {
        const weeksLeft = Math.min(7, days);
        DOM.weekly.textContent = euro(Math.max(0, (remaining / days) * weeksLeft));
    }
    if (DOM.days) DOM.days.textContent = `${days} ${days === 1 ? "Tag" : "Tage"} verbleibend`;

    const budgetField = document.getElementById("budgetValueField");
    if (budgetField) budgetField.textContent = euro(budget);
    if (DOM.spentValue) DOM.spentValue.textContent = euro(spent);

    if (DOM.remaining) {
        DOM.remaining.textContent = euro(remaining);
        DOM.remaining.style.color = remaining < 0 ? "#ff3b30" : (remaining <= 100 && budget > 0 ? "#ff9500" : "var(--text-berry)");
    }

    if (DOM.progressBar) {
        DOM.progressBar.style.width = budget ? `${Math.min(100, Math.max(0, (spent / budget) * 100))}%` : "0%";
        DOM.progressBar.classList.remove("warning", "danger");
        if (remaining < 0) DOM.progressBar.classList.add("danger");
        else if (remaining <= 100 && budget > 0) DOM.progressBar.classList.add("warning");
    }
    // Ringdiagramm & Statistik berechnen
    if (DOM.statsList && DOM.statsChart && DOM.statsTotal) {
        if (expenses.length === 0 || spent <= 0) {
            DOM.statsChart.style.background = "#e8e8e4";
            DOM.statsTotal.textContent = euro(0);
            DOM.statsList.innerHTML = `<div class="empty" style="padding:0;text-align:left;">Keine Daten.</div>`;
        } else {
            const categories = {};
            expenses.forEach(x => {
                const amt = Number(x.amount) || 0;
                if (amt > 0) categories[x.category] = (categories[x.category] || 0) + amt;
            });

            const sortedCats = Object.keys(categories)
                .map(cat => ({ name: cat, total: categories[cat], percent: (categories[cat] / spent) * 100 }))
                .sort((a, b) => b.total - a.total);

            DOM.statsTotal.textContent = euro(spent);

            const colors = ["#3d3035", "#6b5259", "#967880", "#c2a4ac", "#dfcbd0", "#eddde1"];
            let currentAngle = 0;
            const gradientSegments = sortedCats.map((cat, i) => {
                const color = colors[i % colors.length];
                const nextAngle = currentAngle + (cat.percent * 3.6);
                const segment = `${color} ${currentAngle}deg ${nextAngle}deg`;
                currentAngle = nextAngle;
                return segment;
            });

            DOM.statsChart.style.background = `conic-gradient(${gradientSegments.join(", ")})`;
            DOM.statsList.innerHTML = sortedCats.map((cat, i) => {
                const emoji = getCategoryEmoji(cat.name);
                const fullCatName = emoji ? `${emoji} ${cat.name}` : cat.name;
                return `
                    <div class="stat-item">
                        <div class="stat-row">
                            <span class="stat-name">${esc(fullCatName)} <span style="color:#777770;font-weight:400;">(${Math.round(cat.percent)}%)</span></span>
                            <span class="stat-value">${euro(cat.total)}</span>
                        </div>
                        <div class="stat-bar-bg"><div class="stat-bar-fill" style="width: ${cat.percent}%; background: ${colors[i % colors.length]};"></div></div>
                    </div>
                `;
            }).join("");
        }
    }

    // Liste der Ausgaben rendern
    if (DOM.expensesList) {
        if (expenses.length === 0) {
            DOM.expensesList.innerHTML = `<div class="empty">Noch keine Ausgaben in diesem Zeitraum.</div>`;
        } else {
            DOM.expensesList.innerHTML = expenses
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(x => {
                    const emoji = getCategoryEmoji(x.category);
                    const fullCatName = emoji ? `${emoji} ${x.category}` : x.category;
                    return `
                        <div class="expense">
                            <div class="expense-main">
                                <div class="expense-title">${esc(fullCatName)}</div>
                                <div class="expense-meta">${new Date(x.date).toLocaleDateString("de-DE")}${x.note ? " · " + esc(x.note) : ""}</div>
                            </div>
                            <div class="expense-amount">−${euro(x.amount)}</div>
                            <div class="expense-actions">
                                <button type="button" data-id="${esc(x.id)}" class="edit-exp-btn" title="Bearbeiten">✎</button>
                                <button type="button" data-id="${esc(x.id)}" class="delete-exp-btn" title="Löschen">×</button>
                            </div>
                        </div>
                    `;
                }).join("");
        }
    }
}

/* ==========================================================================
   5. DIALOG STEUERUNG
   ========================================================================== */
function openBudget() {
    const p = getPeriod();
    const currentBudget = state.budgets[p.key];
    if (DOM.budgetInput) {
        DOM.budgetInput.value = currentBudget ? String(currentBudget).replace(".", ",") : "";
        DOM.budgetDialog?.showModal();
        DOM.budgetInput.focus();
    }
}

function editExpense(id) {
    const expense = state.expenses.find(x => x.id === id);
    if (!expense) return;

    if (DOM.expenseTitle) DOM.expenseTitle.textContent = "Ausgabe bearbeiten";
    if (DOM.expenseId) DOM.expenseId.value = expense.id;
    if (DOM.expenseAmount) DOM.expenseAmount.value = String(expense.amount).replace(".", ",");
    if (DOM.expenseCategory) DOM.expenseCategory.value = expense.category;
    if (DOM.expenseNote) DOM.expenseNote.value = expense.note || "";
    DOM.expenseDialog?.showModal();
}

function deleteExpense(id) {
    expenseIdToDelete = id;
    DOM.deleteConfirmDialog?.showModal();
}
/* ==========================================================================
   6. EVENT LISTENERS & HOOKS (START-BLOCK)
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    // DOM Cache befüllen & Ausfallsicherung für Schreibweisen im HTML
    Object.keys(DOM).forEach(key => { 
        DOM[key] = $(key === "expensesList" ? "expenses" : key); 
    });

    // Manuelle ausfallsichere Verknüpfungen für alle neuen Kategorie-Elemente
    DOM.settingsCategoryList = $("settingsCategoryList") || $("settingscategorylist");
    DOM.newCategoryInput = $("newCategoryInput") || $("newcategoryinput");
    DOM.addCategoryBtn = $("addCategoryBtn") || $("addcategorybtn");

    // Holt sich auch die neuen Dialog-Elemente manuell ins System (Ausfallsicher)
    DOM.deleteCategoryDialog = $("deleteCategoryDialog") || $("deletecategorydialog");
    DOM.deleteCategoryWarningText = $("deleteCategoryWarningText") || $("deletecategorywarningtext");
    DOM.cancelDeleteCatBtn = $("cancelDeleteCatBtn") || $("canceldeletecatbtn");
    DOM.confirmDeleteCatBtn = $("confirmDeleteCatBtn") || $("confirmdeletecatbtn");

    render();
    applyTheme(); 
    renderCategorySelect(); 

    DOM.budgetValue?.addEventListener("click", openBudget);

    DOM.addBtn?.addEventListener("click", () => {
        if (DOM.expenseTitle) DOM.expenseTitle.textContent = "Neue Ausgabe";
        if (DOM.expenseId) DOM.expenseId.value = "";
        if (DOM.expenseAmount) DOM.expenseAmount.value = "";
        if (DOM.expenseNote) DOM.expenseNote.value = "";
        if (DOM.expenseCategory && state.categories && state.categories.length > 0) {
            DOM.expenseCategory.value = state.categories[0];
        }
        DOM.expenseDialog?.showModal();
        DOM.expenseAmount?.focus();
    });

    DOM.settingsBtn?.addEventListener("click", () => {
        DOM.settingsDialog?.showModal();
        if (DOM.startDayInput) DOM.startDayInput.value = state.startDay || 24;
        if (DOM.themeSelect) DOM.themeSelect.value = state.theme || "light";
        
        renderSettingsCategories();
    });

    DOM.addCategoryBtn?.addEventListener("click", () => {
        if (!DOM.newCategoryInput) return;
        const newCat = DOM.newCategoryInput.value.trim();
        
        if (newCat) {
            if (!state.categories) state.categories = ["Lebensmittel", "Drogerie", "Haushalt", "Kleidung", "Freizeit", "Auto", "Gesundheit", "Tabakwaren", "Sonstiges"];
            
            if (!state.categories.includes(newCat)) {
                state.categories.push(newCat); 
                if (save()) {
                    DOM.newCategoryInput.value = ""; 
                    renderSettingsCategories();     
                    renderCategorySelect();         
                }
            } else {
                alert("Diese Kategorie existiert bereits!");
            }
        }
    });

    // NEU: Klick-Event für das Abbrechen der Kategorie-Löschung
    DOM.cancelDeleteCatBtn?.addEventListener("click", () => {
        DOM.deleteCategoryDialog?.close();
        catIndexToDelete = null;
    });

    // NEU: Klick-Event für das endgültige Löschen trotz aktiver Ausgaben
    DOM.confirmDeleteCatBtn?.addEventListener("click", () => {
        if (catIndexToDelete !== null && state.categories && state.categories[catIndexToDelete]) {
            state.categories.splice(catIndexToDelete, 1);
            if (save()) {
                renderSettingsCategories();
                renderCategorySelect();
                render();
            }
        }
        DOM.deleteCategoryDialog?.close();
        catIndexToDelete = null;
    });

    DOM.startDayInput?.addEventListener("change", (e) => {
        let val = parseInt(e.target.value, 10) || 24;
        state.startDay = Math.min(28, Math.max(1, val));
        if (save()) render();
    });

    DOM.themeSelect?.addEventListener("change", (e) => {
        state.theme = e.target.value;
        if (save()) applyTheme();
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (state.theme === "auto") applyTheme();
    });

    DOM.budgetForm?.addEventListener("submit", (e) => {
        e.preventDefault(); 
        if (e.submitter?.value === "save" && DOM.budgetInput) {
            const p = getPeriod();
            state.budgets[p.key] = Number(DOM.budgetInput.value.trim().replace(",", ".")) || 0;
            if (save()) render();
        }
        DOM.budgetDialog?.close();
    });

    DOM.expenseForm?.addEventListener("submit", (e) => {
        e.preventDefault(); 
        if (e.submitter?.value === "save" && DOM.expenseAmount) {
            const amount = Number(DOM.expenseAmount.value.trim().replace(",", "."));
            if (!amount || isNaN(amount)) return;

            const id = DOM.expenseId?.value;
            const expense = {
                id: id || newId(),
                amount,
                category: DOM.expenseCategory?.value || "Sonstiges", 
                note: DOM.expenseNote?.value.trim() || "",
                date: id ? state.expenses.find(x => x.id === id)?.date || dateKey(new Date()) : dateKey(new Date())
            };

            if (id) {
                state.expenses = state.expenses.map(x => x.id === id ? expense : x);
            } else {
                state.expenses.push(expense);
            }

            if (save()) render();
        }
        DOM.expenseDialog?.close();
    });

    DOM.expensesList?.addEventListener("click", (e) => {
        const editBtn = e.target.closest(".edit-exp-btn");
        const deleteBtn = e.target.closest(".delete-exp-btn");
        if (editBtn) editExpense(editBtn.dataset.id);
        if (deleteBtn) deleteExpense(deleteBtn.dataset.id);
    });

    DOM.confirmDeleteBtn?.addEventListener("click", () => {
        if (expenseIdToDelete) {
            state.expenses = state.expenses.filter(x => x.id !== expenseIdToDelete);
            if (save()) render();
        }
        DOM.deleteConfirmDialog?.close();
        expenseIdToDelete = null;
    });

    DOM.cancelDeleteBtn?.addEventListener("click", () => {
        DOM.deleteConfirmDialog?.close();
        expenseIdToDelete = null;
    });

    DOM.directExportBtn?.addEventListener("click", () => {
        const text = JSON.stringify(state);
        navigator.clipboard.writeText(text)
            .then(() => {
                if (DOM.exportToast) {
                    DOM.exportToast.style.display = "block";
                    setTimeout(() => { if (DOM.exportToast) DOM.exportToast.style.display = "none"; }, 4500);
                }
            })
            .catch(() => {
                alert(`Kopieren fehlgeschlagen! Bitte markiere und kopiere den folgenden Code manuell für deine Notizen-App:\n\n${text}`);
            });
    });

    DOM.directImportBtn?.addEventListener("click", () => {
        if (DOM.importCodeInput) DOM.importCodeInput.value = "";
        DOM.importDataDialog?.showModal();
    });

    DOM.cancelImportBtn?.addEventListener("click", () => {
        DOM.importDataDialog?.close();
    });

    DOM.confirmImportBtn?.addEventListener("click", () => {
        const raw = DOM.importCodeInput?.value?.trim();
        if (raw) {
            try {
                const imported = JSON.parse(raw);
                if (imported.budgets && Array.isArray(imported.expenses)) {
                    state = imported;
                    if (!state.startDay) state.startDay = 24;
                    if (save()) { 
                        render(); 
                        DOM.importDataDialog?.close();
                        DOM.settingsDialog?.close(); 
                    }
                } else { alert("❌ Falsches Datenformat."); }
            } catch { alert("❌ Ungültiger Code."); }
        } else {
            DOM.importDataDialog?.close();
        }
    });

    DOM.settingsDialog?.addEventListener("close", () => {
        if (DOM.exportToast) DOM.exportToast.style.display = "none";
    });
});

/* ==========================================================================
   7. SERVICE WORKER (VERSION GEÄNDERT FÜR INSTANT-UPDATE)
   ========================================================================== */
if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js?v=12").catch(() => {});
    });
}
