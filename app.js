// 
//     Initialisierung & Daten-Speicher
// 

const KEY = "meinBudget_v5";
let state = loadState();

// DOM-Elemente einmalig cachen für maximale Render-Performance
const DOM = {
    periodLabel: null, remaining: null, daily: null, days: null,
    budgetValue: null, spentValue: null, progressBar: null,
    statsList: null, statsChart: null, statsTotal: null,
    expensesList: null, budgetInput: null, budgetDialog: null,
    budgetForm: null, expenseForm: null, expenseAmount: null,
    expenseId: null, expenseCategory: null, expenseNote: null,
    expenseDialog: null, expenseTitle: null, settingsDialog: null,
    startDayInput: null, settingsBtn: null,     dataManagementDropdown: null, exportSuccessDialog: null, closeExportSuccessBtn: null,
    importDataDialog: null, importCodeInput: null, confirmImportBtn: null, cancelImportBtn: null,
    addBtn: null,deleteConfirmDialog: null, confirmDeleteBtn: null, cancelDeleteBtn: null,

};

// Hilfsfunktion zur einfachen Element-Zuweisung
const $ = id => document.getElementById(id);

/* ==========================================================================
   1. DATEN LADEN & INITIALISIEREN
   ========================================================================= */
function loadState() {
    try {
        for (const version of ["_v3", "_v2", "_v1"]) {
            const saved = JSON.parse(localStorage.getItem(KEY.replace("_v3", version)) || "null");
            if (saved && saved.budgets && Array.isArray(saved.expenses)) {
                if (!saved.startDay) saved.startDay = 24;
                return saved;
            }
        }
    } catch (e) {
        console.error("Fehler beim Laden der Daten:", e);
    }
    return { period: "month", startDay: 24, budgets: {}, expenses: [] };
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

//
//   Zeitraums- und Datumslogik
//

/* ==========================================================================
   2. HILFSFUNKTIONEN & FORMATIERUNG
   ========================================================================= */
const euro = n => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
const pad = n => String(n).padStart(2, "0");
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const esc = s => String(s || "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const newId = () => `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

function nextWeekday(d) {
    const x = new Date(d);
    const day = x.getDay();
    if (day === 6) x.setDate(x.getDate() + 2);
    if (day === 0) x.setDate(x.getDate() + 1);
    return x;
}

/* ==========================================================================
   3. ZEITRAUM (Dynamisch basierend auf individuellem Zahltag)
   ========================================================================== */
function getPeriod() {
    const now = new Date();
    const startDay = state?.startDay || 24;

    let start = new Date(now.getFullYear(), now.getMonth(), startDay, 0, 0, 0, 0);
    if (now < start) start.setMonth(start.getMonth() - 1);
    start = nextWeekday(start);

    let endTarget = new Date(start.getFullYear(), start.getMonth() + 1, startDay, 0, 0, 0, 0);
    endTarget.setDate(endTarget.getDate() - 1);
    const end = new Date(endTarget.getFullYear(), endTarget.getMonth(), endTarget.getDate(), 23, 59, 59, 999);

    return {
        key: `p_${dateKey(start)}`,
        start,
        end,
        label: `${start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} – ${end.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`
    };
}

function inPeriod(expense, p) {
    if (!expense.date) return false;
    const d = new Date(expense.date);
    d.setHours(0, 0, 0, 0); // Verhindert Zeitzonen-Fehler
    return d >= p.start && d <= p.end;
}
//
//   Die Render-Funktion (UI-Aufbau & Statistik)
//
/* ==========================================================================
   4. ANZEIGE (RENDER-FUNKTION)
   ========================================================================== */
function render() {
    const p = getPeriod();
    const expenses = state.expenses.filter(x => inPeriod(x, p));
    const spent = expenses.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
    const budget = Number(state.budgets[p.key] || 0);
    const remaining = budget - spent;
    const now = new Date();
    const days = Math.max(1, Math.ceil((p.end - now) / 86400000));

    // Textfelder befüllen
    if (DOM.periodLabel) DOM.periodLabel.textContent = `Zeitraum: ${p.label}`;
    if (DOM.daily) DOM.daily.textContent = `${euro(Math.max(0, remaining / days))} pro Tag`;
    if (DOM.days) DOM.days.textContent = `${days} ${days === 1 ? "Tag" : "Tage"} verbleibend`;
// Schreibt den Wert ins Textfeld, ohne die Klick-Fläche zu beschädigen
const budgetField = document.getElementById("budgetValueField");
if (budgetField) budgetField.textContent = euro(budget);
    if (DOM.spentValue) DOM.spentValue.textContent = euro(spent);

    if (DOM.remaining) {
        DOM.remaining.textContent = euro(remaining);
        DOM.remaining.style.color = remaining < 0 ? "#ff3b30" : (remaining <= 100 && budget > 0 ? "#ff9500" : "#2b2024");
    }

    // Fortschrittsbalken aktualisieren
    if (DOM.progressBar) {
        DOM.progressBar.style.width = budget ? `${Math.min(100, Math.max(0, (spent / budget) * 100))}%` : "0%";
        DOM.progressBar.classList.remove("warning", "danger");
        if (remaining < 0) DOM.progressBar.classList.add("danger");
        else if (remaining <= 100 && budget > 0) DOM.progressBar.classList.add("warning");
    }

    // Statistik berechnen & rendern
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
            DOM.statsList.innerHTML = sortedCats.map((cat, i) => `
                <div class="stat-item">
                    <div class="stat-row">
                        <span class="stat-name">${esc(cat.name)} <span style="color:#777770;font-weight:400;">(${Math.round(cat.percent)}%)</span></span>
                        <span class="stat-value">${euro(cat.total)}</span>
                    </div>
                    <div class="stat-bar-bg"><div class="stat-bar-fill" style="width: ${cat.percent}%; background: ${colors[i % colors.length]};"></div></div>
                </div>
            `).join("");
        }
    }

    // Ausgabenliste rendern
    if (DOM.expensesList) {
        if (expenses.length === 0) {
            DOM.expensesList.innerHTML = `<div class="empty">Noch keine Ausgaben in diesem Zeitraum.</div>`;
        } else {
            DOM.expensesList.innerHTML = expenses
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(x => `
                    <div class="expense">
                        <div class="expense-main">
                            <div class="expense-title">${esc(x.category)}</div>
                            <div class="expense-meta">${new Date(x.date).toLocaleDateString("de-DE")}${x.note ? " · " + esc(x.note) : ""}</div>
                        </div>
                        <div class="expense-amount">−${euro(x.amount)}</div>
                        <div class="expense-actions">
                            <button type="button" data-id="${esc(x.id)}" class="edit-exp-btn" title="Bearbeiten">✎</button>
                            <button type="button" data-id="${esc(x.id)}" class="delete-exp-btn" title="Löschen">×</button>
                        </div>
                    </div>
                `).join("");
        }
    }
}
//
//   Knöpfen und Formulare, Interaktionen, Events & Service Worker
//
/* ==========================================================================
   5. DIALOG INTERAKTIONEN & LOGIK
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

// Variable, um sich die ID der zu löschenden Ausgabe kurzzeitig zu merken
let expenseIdToDelete = null;

function deleteExpense(id) {
    expenseIdToDelete = id;
    // Öffnet den neuen Apple-Style Dialog statt des hässlichen Browser-Confirms
    DOM.deleteConfirmDialog?.showModal();
}

/* ==========================================================================
   6. INITIALISIERUNG & EVENT LISTENERS
   ========================================================================== */
/* ==========================================================================
   6. INITIALISIERUNG & EVENT LISTENERS
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    // DOM Cache befüllen (Verknüpft IDs aus HTML mit dem DOM-Objekt)
    Object.keys(DOM).forEach(key => { 
        DOM[key] = $(key === "expensesList" ? "expenses" : key); 
    });

    render();

    // Event-Klicks für feste Buttons (Nutzt jetzt die korrekte, äußere Klickfläche)
    DOM.budgetValue?.addEventListener("click", openBudget);

    DOM.addBtn?.addEventListener("click", () => {
        if (DOM.expenseTitle) DOM.expenseTitle.textContent = "Neue Ausgabe";
        if (DOM.expenseId) DOM.expenseId.value = "";
        if (DOM.expenseAmount) DOM.expenseAmount.value = "";
        if (DOM.expenseNote) DOM.expenseNote.value = "";
        if (DOM.expenseCategory) DOM.expenseCategory.value = "Lebensmittel";
        DOM.expenseDialog?.showModal();
        DOM.expenseAmount?.focus();
    });

    DOM.settingsBtn?.addEventListener("click", () => {
        DOM.settingsDialog?.showModal();
        if (DOM.startDayInput) DOM.startDayInput.value = state.startDay || 24;
        // Zwingt das Dropdown beim Aufrufen der Einstellungen immer auf den Standardwert zurück
        if (DOM.dataManagementDropdown) DOM.dataManagementDropdown.value = "";
    });

    DOM.startDayInput?.addEventListener("change", (e) => {
        let val = parseInt(e.target.value, 10) || 24;
        state.startDay = Math.min(28, Math.max(1, val));
        if (save()) render();
    });

    // Formular-Absendungen (Submits)
    DOM.budgetForm?.addEventListener("submit", (e) => {
        if (e.submitter?.value === "save" && DOM.budgetInput) {
            const p = getPeriod();
            state.budgets[p.key] = Number(DOM.budgetInput.value.trim().replace(",", ".")) || 0;
            if (save()) render();
        }
    });

    DOM.expenseForm?.addEventListener("submit", (e) => {
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
    });

    // Event-Delegation für dynamisch erstellte Listen-Knöpfe
    DOM.expensesList?.addEventListener("click", (e) => {
        const editBtn = e.target.closest(".edit-exp-btn");
        const deleteBtn = e.target.closest(".delete-exp-btn");
        if (editBtn) editExpense(editBtn.dataset.id);
        if (deleteBtn) deleteExpense(deleteBtn.dataset.id);
    });

    // Event-Listener für den iOS-Löschdialog
    DOM.confirmDeleteBtn?.addEventListener("click", () => {
        if (expenseIdToDelete) {
            state.expenses = state.expenses.filter(x => x.id !== expenseIdToDelete);
            if (save()) {
                render();
            }
        }
        DOM.deleteConfirmDialog?.close();
        expenseIdToDelete = null;
    });

    DOM.cancelDeleteBtn?.addEventListener("click", () => {
        DOM.deleteConfirmDialog?.close();
        expenseIdToDelete = null;
    });

    // Daten-Export & Import über das Dropdown
    // Überwacht das Daten-Management-Dropdown im iOS-Style
    DOM.dataManagementDropdown?.addEventListener("change", (e) => {
        const action = e.target.value;
        if (!action) return;

        if (action === "export") {
            const text = JSON.stringify(state);
            navigator.clipboard.writeText(text)
                .then(() => {
                    // Öffnet das neue Apple-Style Erfolgsfenster
                    DOM.exportSuccessDialog?.showModal();
                })
                .catch(() => {
                    alert(`Automatisches Kopieren fehlgeschlagen. Dein Code:\n\n${text}`);
                });
        }

        if (action === "import") {
            if (DOM.importCodeInput) DOM.importCodeInput.value = ""; // Feld leeren
            // Öffnet das neue Apple-Style Eingabefenster
            DOM.importDataDialog?.showModal();
        }

        // Setzt das Dropdown sofort wieder auf den Standard-Text zurück
        e.target.value = "";
    });

    // Schließt das Export-Erfolgsfenster
    DOM.closeExportSuccessBtn?.addEventListener("click", () => {
        DOM.exportSuccessDialog?.close();
    });

    // Bricht den Import ab
    DOM.cancelImportBtn?.addEventListener("click", () => {
        DOM.importDataDialog?.close();
    });

    // Bestätigt den Import und liest die Daten ein
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
                    }
                } else { 
                    alert("❌ Falsches Datenformat."); 
                }
            } catch { 
                alert("❌ Ungültiger Code."); 
            }
        } else {
            DOM.importDataDialog?.close();
        }
    });
});

/* ==========================================================================
   7. SERVICE WORKER
   ========================================================================== */
if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js?v=5").catch(() => {});
    });
}
