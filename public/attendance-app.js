/* eslint-disable */

      const TABLE = "office_logs";
      const SETTINGS_TABLE = "office_day_settings";
      const TIME_COL = "event_time";
      const TYPE_COL = "event_type";
      const LABEL_COL = "event_label";
      const LEAVE_CATEGORY_COL = "leave_category";
      const API = {
        adminSession: "/api/admin/session",
        bootstrap: "/api/bootstrap",
        attendance: "/api/attendance",
        leaveSync: "/api/leave/sync",
        wfhSync: "/api/wfh/sync",
      };
      const LEAVE_CATEGORIES = [
        "Earned Leave",
        "Casual Leave",
        "Sick Leave",
        "Compensatory Off",
        "Public Holidays",
        "Restricted Holidays",
        "Loss of Pay (LOP)",
      ];

      let leaveSettings = { weekdays: [] };
      let leaveRecords = [];
      let wfhRecords = [];

      function getSpecificLeaveRecord(dateStr) {
        return leaveRecords.find((item) => item.date === dateStr) || null;
      }

      function getSpecificWfhRecord(dateStr) {
        return wfhRecords.find((item) => item.date === dateStr) || null;
      }

      function isLeaveDay(dateObj) {
        const wd = dateObj.getDay();
        if (leaveSettings.weekdays.includes(wd)) return true;
        return !!getSpecificLeaveRecord(dateKey(dateObj));
      }

      function isWfhDay(dateObj) {
        return !!getSpecificWfhRecord(dateKey(dateObj));
      }

      function getLeaveDateLabel(dateStr) {
        const found = getSpecificLeaveRecord(dateStr);
        return found ? found.label : "";
      }

      function getLeaveCategory(dateStr) {
        const found = getSpecificLeaveRecord(dateStr);
        return found ? found.category || "" : "";
      }

      function isRecurringLeaveDay(dateObj) {
        const record = getSpecificLeaveRecord(dateKey(dateObj));
        return isLeaveDay(dateObj) && (!record || !record.category);
      }

      function getDayStatus(dateObj) {
        if (isLeaveDay(dateObj)) return "LEAVE";
        if (isWfhDay(dateObj)) return "WFH";
        return null;
      }

      async function requestJson(path, options = {}) {
        const headers = {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {}),
        };
        const res = await fetch(path, {
          ...options,
          headers,
          credentials: "same-origin",
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const error = new Error(
            body || `HTTP ${res.status}`,
          );
          error.status = res.status;
          throw error;
        }
        if (res.status === 204) return null;
        return res.json();
      }

      function isUnauthorizedError(error) {
        return !!error && typeof error === "object" && error.status === 401;
      }

      async function verifyAdminPin(pin) {
        await requestJson(API.adminSession, {
          method: "POST",
          body: JSON.stringify({ pin }),
        });
        adminUnlocked = true;
        updateStrip();
      }

      async function clearAdminSession() {
        await requestJson(API.adminSession, { method: "DELETE" });
        adminUnlocked = false;
        updateStrip();
      }

      const MONTHS = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      let allLogs = [],
        allRows = [],
        viewYear,
        viewMonth,
        selectedCell = null;
      let adminUnlocked = false;
      let pinBuffer = "",
        pinResolve = null;
      let selectedAddType = "IN";
      let detailCurrentDate = null;

      const $ = (id) => document.getElementById(id);
      const pad = (n) => String(n).padStart(2, "0");

      function dateKey(d) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }

      function formatTime(d) {
        let h = d.getHours(),
          m = d.getMinutes(),
          ap = h >= 12 ? "PM" : "AM";
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${pad(h)}:${pad(m)} ${ap}`;
      }

      function formatFullDate(d) {
        return `${DAYS_SHORT[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      }

      function buildDayMap(logs) {
        const map = {};
        logs.forEach((l) => {
          const k = dateKey(l._date);
          (map[k] = map[k] || []).push(l);
        });
        return map;
      }

      function showError(msg, detail) {
        $("loading").style.display = "none";
        $("app").style.display = "none";
        $("emptyState").style.display = "none";
        $("errorMsg").textContent = msg;
        const dc = $("errorDetail");
        dc.textContent = detail || "";
        dc.style.display = detail ? "block" : "none";
        $("errorBox").style.display = "block";
      }

      function updatePinDots() {
        for (let i = 0; i < 4; i++) {
          const d = $(`pd${i}`);
          d.classList.remove("filled", "error");
          if (i < pinBuffer.length) d.classList.add("filled");
        }
      }

      function flashPinError(msg) {
        $("pinError").textContent = msg;
        for (let i = 0; i < 4; i++) {
          const d = $(`pd${i}`);
          d.classList.remove("filled");
          d.classList.add("error");
        }
        const dots = $("pinDots");
        dots.classList.add("shake");
        setTimeout(() => {
          dots.classList.remove("shake");
          for (let i = 0; i < 4; i++) $("pd" + i).classList.remove("error");
          $("pinError").textContent = "";
          pinBuffer = "";
          updatePinDots();
        }, 600);
      }

      function openPinModal() {
        return new Promise((resolve) => {
          pinResolve = resolve;
          pinBuffer = "";
          $("pinError").textContent = "";
          updatePinDots();
          $("pinOverlay").classList.add("visible");
        });
      }

      function closePinModal(ok) {
        $("pinOverlay").classList.remove("visible");
        if (pinResolve) {
          pinResolve(ok);
          pinResolve = null;
        }
      }

      $("pinKeypad").addEventListener("click", (e) => {
        const btn = e.target.closest(".pin-key");
        if (!btn) return;
        const k = btn.dataset.k;
        if (k === "del") {
          pinBuffer = pinBuffer.slice(0, -1);
          updatePinDots();
          return;
        }
        if (pinBuffer.length >= 4) return;
        pinBuffer += k;
        updatePinDots();
        if (pinBuffer.length === 4) {
          verifyAdminPin(pinBuffer)
            .then(() => closePinModal(true))
            .catch(() => flashPinError("Incorrect PIN"));
        }
      });

      document.addEventListener("keydown", (e) => {
        if (
          $("addOverlay").classList.contains("visible") ||
          $("leaveOverlay").classList.contains("visible") ||
          $("wfhOverlay").classList.contains("visible")
        )
          return;
        if (!$("pinOverlay").classList.contains("visible")) return;
        if (e.key >= "0" && e.key <= "9") {
          if (pinBuffer.length < 4) {
            pinBuffer += e.key;
            updatePinDots();
          }
          if (pinBuffer.length === 4) {
            verifyAdminPin(pinBuffer)
              .then(() => closePinModal(true))
              .catch(() => flashPinError("Incorrect PIN"));
          }
        } else if (e.key === "Backspace") {
          pinBuffer = pinBuffer.slice(0, -1);
          updatePinDots();
        } else if (e.key === "Escape") {
          closePinModal(false);
        }
      });

      $("pinCancel").addEventListener("click", () => closePinModal(false));
      $("pinOverlay").addEventListener("click", (e) => {
        if (e.target === $("pinOverlay")) closePinModal(false);
      });

      function updateStrip() {
        const strip = $("adminStrip"),
          label = $("stripLabel"),
          btn = $("stripBtn");
        if (adminUnlocked) {
          strip.classList.add("unlocked");
          label.textContent = "Admin mode - Unlocked";
          btn.textContent = "Lock";
        } else {
          strip.classList.remove("unlocked");
          label.textContent = "Admin mode - Locked";
          btn.textContent = "Unlock";
        }
        document.querySelectorAll(".delete-btn").forEach((b) => {
          if (adminUnlocked) b.classList.remove("locked");
          else b.classList.add("locked");
        });
        const dab = $("detailAddBtn");
        if (dab) {
          if (adminUnlocked) dab.classList.remove("locked");
          else dab.classList.add("locked");
        }
        updateStatusModalAccess();
      }

      function updateStatusModalAccess() {
        const leaveAdmin = $("leaveAdminControls");
        const leaveSave = $("leaveSaveBtn");
        const leaveReadonly = $("leaveReadonlyNote");
        const wfhAdmin = $("wfhAdminControls");
        const wfhSave = $("wfhSaveBtn");
        const wfhReadonly = $("wfhReadonlyNote");
        if (leaveAdmin) leaveAdmin.classList.toggle("visible", adminUnlocked);
        if (leaveSave) leaveSave.classList.toggle("visible", adminUnlocked);
        if (leaveReadonly) leaveReadonly.style.display = adminUnlocked ? "none" : "block";
        if (wfhAdmin) wfhAdmin.classList.toggle("visible", adminUnlocked);
        if (wfhSave) wfhSave.classList.toggle("visible", adminUnlocked);
        if (wfhReadonly) wfhReadonly.style.display = adminUnlocked ? "none" : "block";
      }

      function openNativePicker(input) {
        if (!input || input.disabled || input.readOnly) return;
        input.focus();
        if (typeof input.showPicker === "function") {
          try {
            input.showPicker();
          } catch (_) {}
        }
      }

      function bindDateInputPicker(id) {
        const input = $(id);
        if (!input) return;

        const open = () => openNativePicker(input);

        input.addEventListener("click", open);
        input.addEventListener("focus", open);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            open();
          }
        });
      }

      $("stripBtn").addEventListener("click", async () => {
        if (adminUnlocked) {
          try {
            await clearAdminSession();
          } catch (error) {
            alert("Could not lock admin mode: " + error.message);
          }
        } else {
          await openPinModal();
        }
      });

      let tempLeave = null;
      let tempWfh = null;
      let leaveListExpanded = false;
      let wfhListExpanded = false;

      function openLeaveModal() {
        tempLeave = {
          weekdays: [...leaveSettings.weekdays],
          dates: leaveRecords.map((item) => ({
            id: item.id,
            date: item.date,
            category: item.category || "",
            label: item.label || "",
          })),
        };
        leaveListExpanded = false;
        renderWeekdayGrid();
        renderLeaveList();
        updateStatusModalAccess();
        $("leaveDateInput").value = "";
        $("leaveCategoryInput").value = "";
        $("leaveLabelInput").value = "";
        $("leaveOverlay").classList.add("visible");
      }

      $("leaveBtn").addEventListener("click", openLeaveModal);
      $("leaveClose").addEventListener("click", () => {
        $("leaveOverlay").classList.remove("visible");
        tempLeave = null;
      });
      $("leaveOverlay").addEventListener("click", (e) => {
        if (e.target === $("leaveOverlay")) {
          $("leaveOverlay").classList.remove("visible");
          tempLeave = null;
        }
      });
      $("leaveListToggle").addEventListener("click", () => {
        leaveListExpanded = !leaveListExpanded;
        renderLeaveList();
      });

      function openWfhModal() {
        tempWfh = {
          dates: wfhRecords.map((item) => ({ id: item.id, date: item.date })),
        };
        wfhListExpanded = false;
        renderWfhList();
        updateStatusModalAccess();
        $("wfhDateInput").value = "";
        $("wfhOverlay").classList.add("visible");
      }

      $("wfhBtn").addEventListener("click", openWfhModal);
      $("wfhClose").addEventListener("click", () => {
        $("wfhOverlay").classList.remove("visible");
        tempWfh = null;
      });
      $("wfhOverlay").addEventListener("click", (e) => {
        if (e.target === $("wfhOverlay")) {
          $("wfhOverlay").classList.remove("visible");
          tempWfh = null;
        }
      });
      $("wfhListToggle").addEventListener("click", () => {
        wfhListExpanded = !wfhListExpanded;
        renderWfhList();
      });

      function renderWeekdayGrid() {
        document.querySelectorAll("#weekdayGrid .wd-btn").forEach((btn) => {
          const wd = parseInt(btn.dataset.wd, 10);
          btn.classList.toggle("active", tempLeave.weekdays.includes(wd));
          btn.onclick = () => {
            const idx = tempLeave.weekdays.indexOf(wd);
            if (idx >= 0) tempLeave.weekdays.splice(idx, 1);
            else tempLeave.weekdays.push(wd);
            renderWeekdayGrid();
          };
        });
      }

      function renderLeaveList() {
        const list = $("leaveList");
        const toggle = $("leaveListToggle");
        list.innerHTML = "";
        if (!tempLeave.dates.length) {
          list.innerHTML =
            '<div class="leave-empty">No specific dates added</div>';
          toggle.style.display = "none";
          return;
        }
        const sortedDates = [...tempLeave.dates].sort((a, b) =>
          b.date.localeCompare(a.date),
        );
        const visibleDates = leaveListExpanded ? sortedDates : sortedDates.slice(0, 1);
        visibleDates.forEach((item) => {
          const li = document.createElement("li");
          li.className = "leave-item";
          const realIdx = tempLeave.dates.findIndex(
            (entry) =>
              entry.date === item.date &&
              (entry.category || "") === (item.category || "") &&
              (entry.label || "") === (item.label || ""),
          );
          const leaveSummary = item.label
            ? `${item.category || "Uncategorized Leave"} - ${item.label}`
            : item.category || "Uncategorized Leave";
          li.innerHTML = `<div class="leave-item-dot"></div><div class="leave-item-info"><div class="leave-item-date">${item.date}</div><div class="leave-item-label">${leaveSummary}</div></div>${adminUnlocked ? `<button class="leave-item-del" data-idx="${realIdx}">×</button>` : ""}`;
          list.appendChild(li);
        });
        list.querySelectorAll(".leave-item-del").forEach((btn) => {
          btn.onclick = () => {
            tempLeave.dates.splice(parseInt(btn.dataset.idx, 10), 1);
            renderLeaveList();
          };
        });
        if (sortedDates.length > 1) {
          toggle.style.display = "block";
          toggle.textContent = leaveListExpanded
            ? "Show latest leave"
            : `Show all ${sortedDates.length} leaves`;
        } else {
          toggle.style.display = "none";
        }
      }

      function renderWfhList() {
        const list = $("wfhList");
        const toggle = $("wfhListToggle");
        list.innerHTML = "";
        if (!tempWfh.dates.length) {
          list.innerHTML =
            '<div class="wfh-empty">No specific WFH dates added</div>';
          toggle.style.display = "none";
          return;
        }
        const sortedDates = [...tempWfh.dates].sort((a, b) =>
          b.date.localeCompare(a.date),
        );
        const visibleDates = wfhListExpanded ? sortedDates : sortedDates.slice(0, 1);
        visibleDates.forEach((item) => {
          const li = document.createElement("li");
          li.className = "wfh-item";
          const realIdx = tempWfh.dates.findIndex(
            (entry) => entry.date === item.date,
          );
          li.innerHTML = `<div class="wfh-item-dot"></div><div class="wfh-item-info"><div class="wfh-item-date">${item.date}</div></div>${adminUnlocked ? `<button class="wfh-item-del" data-idx="${realIdx}">×</button>` : ""}`;
          list.appendChild(li);
        });
        list.querySelectorAll(".wfh-item-del").forEach((btn) => {
          btn.onclick = () => {
            tempWfh.dates.splice(parseInt(btn.dataset.idx, 10), 1);
            renderWfhList();
          };
        });
        if (sortedDates.length > 1) {
          toggle.style.display = "block";
          toggle.textContent = wfhListExpanded
            ? "Show latest WFH"
            : `Show all ${sortedDates.length} WFH`;
        } else {
          toggle.style.display = "none";
        }
      }

      function addSpecificLeave() {
        const dateVal = $("leaveDateInput").value;
        const categoryVal = $("leaveCategoryInput").value;
        const labelVal = $("leaveLabelInput").value.trim();
        if (!dateVal) {
          alert("Please pick a date.");
          return;
        }
        if (!categoryVal) {
          alert("Please select a leave category.");
          return;
        }
        if (tempLeave.dates.some((d) => d.date === dateVal)) {
          alert("This date is already added.");
          return;
        }
        tempLeave.dates.push({
          date: dateVal,
          category: categoryVal,
          label: labelVal,
        });
        $("leaveDateInput").value = "";
        $("leaveCategoryInput").value = "";
        $("leaveLabelInput").value = "";
        renderLeaveList();
      }

      function addSpecificWfh() {
        const dateVal = $("wfhDateInput").value;
        if (!dateVal) {
          alert("Please pick a date.");
          return;
        }
        if (tempWfh.dates.some((d) => d.date === dateVal)) {
          alert("This date is already added.");
          return;
        }
        tempWfh.dates.push({ date: dateVal });
        $("wfhDateInput").value = "";
        renderWfhList();
      }

      function collectPendingLeaveDraft() {
        const dateVal = $("leaveDateInput").value;
        const categoryVal = $("leaveCategoryInput").value;
        const labelVal = $("leaveLabelInput").value.trim();

        if (!dateVal && !categoryVal && !labelVal) return null;
        if (!dateVal) throw new Error("Please pick a date.");
        if (!categoryVal) throw new Error("Please select a leave category.");
        if (tempLeave.dates.some((d) => d.date === dateVal)) return null;

        return {
          date: dateVal,
          category: categoryVal,
          label: labelVal,
        };
      }

      function collectPendingWfhDraft() {
        const dateVal = $("wfhDateInput").value;

        if (!dateVal) return null;
        if (tempWfh.dates.some((d) => d.date === dateVal)) return null;

        return { date: dateVal };
      }

      async function saveLeaveSettings() {
        try {
          const pendingLeave = collectPendingLeaveDraft();
          if (pendingLeave) {
            tempLeave.dates.push(pendingLeave);
          }

          const nextWeekdays = [...tempLeave.weekdays].sort((a, b) => a - b);
          const nextDates = [...tempLeave.dates].sort((a, b) =>
            a.date.localeCompare(b.date),
          );
          await requestJson(API.leaveSync, {
            method: "POST",
            body: JSON.stringify({
              weekdays: nextWeekdays,
              dates: nextDates,
            }),
          });

          $("leaveOverlay").classList.remove("visible");
          tempLeave = null;
          await loadData();

          if (detailCurrentDate) {
            const detailKey = dateKey(detailCurrentDate);
            const dayLogs = allLogs.filter(
              (l) => dateKey(l._date) === detailKey,
            );
            showDetail(detailCurrentDate, dayLogs);
          }
        } catch (e) {
          if (isUnauthorizedError(e)) {
            adminUnlocked = false;
            updateStrip();
            alert("Admin session expired. Unlock again to continue.");
            return;
          }
          alert("Could not save leave settings: " + e.message);
        }
      }

      async function saveWfhSettings() {
        try {
          const pendingWfh = collectPendingWfhDraft();
          if (pendingWfh) {
            tempWfh.dates.push(pendingWfh);
          }

          const nextDates = [...tempWfh.dates].sort((a, b) =>
            a.date.localeCompare(b.date),
          );
          await requestJson(API.wfhSync, {
            method: "POST",
            body: JSON.stringify({ dates: nextDates }),
          });

          $("wfhOverlay").classList.remove("visible");
          tempWfh = null;
          await loadData();

          if (detailCurrentDate) {
            const detailKey = dateKey(detailCurrentDate);
            const dayLogs = allLogs.filter(
              (l) => dateKey(l._date) === detailKey,
            );
            showDetail(detailCurrentDate, dayLogs);
          }
        } catch (e) {
          if (isUnauthorizedError(e)) {
            adminUnlocked = false;
            updateStrip();
            alert("Admin session expired. Unlock again to continue.");
            return;
          }
          alert("Could not save WFH settings: " + e.message);
        }
      }

      function selectType(t) {
        selectedAddType = t;
        $("typeIn").className = "type-btn" + (t === "IN" ? " active-in" : "");
        $("typeOut").className =
          "type-btn" + (t === "OUT" ? " active-out" : "");
      }

      function openAddModal(prefillDate) {
        $("addMsg").textContent = "";
        $("addMsg").className = "add-msg";
        const now = new Date();
        $("addDate").value = prefillDate || now.toISOString().slice(0, 10);
        $("addTime").value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        selectType("IN");
        $("addSubmit").disabled = false;
        $("addOverlay").classList.add("visible");
      }

      $("addClose").addEventListener("click", () =>
        $("addOverlay").classList.remove("visible"),
      );
      $("addOverlay").addEventListener("click", (e) => {
        if (e.target === $("addOverlay"))
          $("addOverlay").classList.remove("visible");
      });

      async function submitLog() {
        const dateVal = $("addDate").value;
        const timeVal = $("addTime").value;
        if (!dateVal || !timeVal) {
          $("addMsg").textContent = "Please fill date and time.";
          $("addMsg").className = "add-msg err";
          return;
        }
        const isoStr = `${dateVal}T${timeVal}:00`;
        const eventDate = new Date(isoStr);
        if (isNaN(eventDate)) {
          $("addMsg").textContent = "Invalid date/time.";
          $("addMsg").className = "add-msg err";
          return;
        }

        $("addSubmit").disabled = true;
        $("addMsg").textContent = "Saving…";
        $("addMsg").className = "add-msg";

        try {
          const inserted = await requestJson(API.attendance, {
            method: "POST",
            body: JSON.stringify({
              eventType: selectedAddType,
              eventTime: eventDate.toISOString(),
            }),
          });
          if (inserted && inserted[0]) {
            const newLog = {
              ...inserted[0],
              _date: new Date(inserted[0][TIME_COL]),
            };
            allRows.push(newLog);
            syncDerivedData();
          }
          $("addMsg").textContent = "✓ Record added!";
          $("addMsg").className = "add-msg ok";
          setTimeout(() => {
            $("addOverlay").classList.remove("visible");
            renderAll();
            refreshDetailIfOpen(dateVal);
          }, 800);
        } catch (e) {
          if (isUnauthorizedError(e)) {
            adminUnlocked = false;
            updateStrip();
            $("addMsg").textContent = "Admin session expired. Unlock again.";
            $("addMsg").className = "add-msg err";
            $("addSubmit").disabled = false;
            return;
          }
          $("addMsg").textContent = "Network error: " + e.message;
          $("addMsg").className = "add-msg err";
          $("addSubmit").disabled = false;
        }
      }

      function refreshDetailIfOpen(dateStr) {
        if (!detailCurrentDate) return;
        const k = dateKey(detailCurrentDate);
        if (k === dateStr) {
          const dayLogs = allLogs.filter((l) => dateKey(l._date) === k);
          showDetail(detailCurrentDate, dayLogs);
        }
      }

      async function loadData() {
        $("errorBox").style.display = "none";
        $("app").style.display = "none";
        $("emptyState").style.display = "none";
        $("loading").style.display = "flex";
        try {
          const data = await requestJson(API.bootstrap);

          allRows = (data.rows || [])
            .map((l) => ({ ...l, _date: new Date(l[TIME_COL]) }))
            .filter((l) => !isNaN(l._date));
          const leaveWeekdays = (data.settings || [])
            .filter((row) => row.setting_type === "LEAVE_WEEKDAY")
            .map((row) => row.weekday);
          leaveSettings = { weekdays: leaveWeekdays };
          adminUnlocked = !!data.adminAuthenticated;
          syncDerivedData();

          const latest = allRows[0]?._date || new Date();
          viewYear = latest.getFullYear();
          viewMonth = latest.getMonth();
          $("loading").style.display = "none";
          $("app").style.display = "block";
          renderAll();
          updateStrip();
        } catch (e) {
          showError(
            "Could not load attendance configuration.",
            e.message,
          );
          return;
        }
      }

      function syncDerivedData() {
        allRows.sort((a, b) => b._date - a._date);
        allLogs = allRows.filter(
          (row) => row[TYPE_COL] !== "LEAVE" && row[TYPE_COL] !== "WFH",
        );
        const leaveMap = new Map();
        allRows
          .filter((row) => row[TYPE_COL] === "LEAVE")
          .forEach((row) => {
            const date = row._date.toISOString().slice(0, 10);
            if (!leaveMap.has(date)) {
              leaveMap.set(date, {
                id: row.id,
                date,
                category: LEAVE_CATEGORIES.includes(row[LEAVE_CATEGORY_COL])
                  ? row[LEAVE_CATEGORY_COL]
                  : "",
                label: row[LABEL_COL] || "",
              });
            }
          });
        leaveRecords = [...leaveMap.values()].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
        const wfhMap = new Map();
        allRows
          .filter((row) => row[TYPE_COL] === "WFH")
          .forEach((row) => {
            const date = row._date.toISOString().slice(0, 10);
            if (!wfhMap.has(date)) {
              wfhMap.set(date, { id: row.id, date });
            }
          });
        wfhRecords = [...wfhMap.values()].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
      }

      function trashSVG() {
        return '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 3h8M4 3V2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M4.5 5v3.5M6.5 5v3.5M2 3l.5 5.5a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5L9 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      }

      async function deleteLog(id, btn, li) {
        if (!adminUnlocked) {
          const ok = await openPinModal();
          if (!ok) return;
          adminUnlocked = true;
          updateStrip();
        }
        if (!btn.dataset.confirming) {
          btn.dataset.confirming = "1";
          btn.classList.add("confirming");
          btn.innerHTML = "Confirm?";
          setTimeout(() => {
            if (btn.dataset.confirming) {
              delete btn.dataset.confirming;
              btn.classList.remove("confirming");
              btn.innerHTML = trashSVG() + " Delete";
            }
          }, 3000);
          return;
        }
        btn.classList.add("deleting");
        btn.textContent = "…";
        try {
          await requestJson(`${API.attendance}/${id}`, {
            method: "DELETE",
          });
          allRows = allRows.filter((l) => l.id !== id);
          syncDerivedData();
          li.style.transition = "opacity 0.18s,transform 0.18s";
          li.style.opacity = "0";
          li.style.transform = "translateX(6px)";
          setTimeout(() => {
            li.remove();
            const rem = $("detailList").querySelectorAll("li").length;
            $("detailCount").textContent =
              `${rem} event${rem !== 1 ? "s" : ""}`;
            if (rem === 0) closeDetail();
            renderCalendar();
            renderStats();
          }, 180);
        } catch (e) {
          if (isUnauthorizedError(e)) {
            adminUnlocked = false;
            updateStrip();
            alert("Admin session expired. Unlock again to continue.");
          } else {
            alert("Network error: " + e.message);
          }
          btn.classList.remove("deleting");
          btn.innerHTML = trashSVG() + " Delete";
        }
      }

      function renderAll() {
        renderMonthLabel();
        renderStats();
        renderCalendar();
      }

      function renderMonthLabel() {
        $("monthLabel").textContent = `${MONTHS[viewMonth]} ${viewYear}`;
      }

      function renderStats() {
        const ml = allLogs.filter(
          (l) =>
            l._date.getFullYear() === viewYear &&
            l._date.getMonth() === viewMonth,
        );
        $("stat-days").textContent = new Set(
          ml.map((l) => dateKey(l._date)),
        ).size;

        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        let leaveDays = 0;
        let wfhDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const dt = new Date(viewYear, viewMonth, d);
          if (isLeaveDay(dt)) leaveDays++;
          if (isWfhDay(dt)) wfhDays++;
        }
        $("stat-leave").textContent = leaveDays;
        $("stat-wfh").textContent = wfhDays;
      }

      function renderCalendar() {
        const grid = $("calGrid");
        grid.innerHTML = "";
        const todayKey = dateKey(new Date());
        const monthLogs = allLogs.filter(
          (l) =>
            l._date.getFullYear() === viewYear &&
            l._date.getMonth() === viewMonth,
        );
        const dayMap = buildDayMap(monthLogs);
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
        const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

        for (let i = 0; i < totalCells; i++) {
          let day,
            month,
            year,
            other = false;
          if (i < firstDay) {
            day = daysInPrev - firstDay + 1 + i;
            month = viewMonth === 0 ? 11 : viewMonth - 1;
            year = viewMonth === 0 ? viewYear - 1 : viewYear;
            other = true;
          } else if (i >= firstDay + daysInMonth) {
            day = i - firstDay - daysInMonth + 1;
            month = viewMonth === 11 ? 0 : viewMonth + 1;
            year = viewMonth === 11 ? viewYear + 1 : viewYear;
            other = true;
          } else {
            day = i - firstDay + 1;
            month = viewMonth;
            year = viewYear;
          }

          const cellDate = new Date(year, month, day);
          const key = dateKey(cellDate);
          const logs = other ? [] : dayMap[key] || [];
          const isToday = key === todayKey;
          const dayStatus = !other ? getDayStatus(cellDate) : null;
          const isLeave = dayStatus === "LEAVE";
          const isWfh = dayStatus === "WFH";
          const isRecurringLeave = isLeave && isRecurringLeaveDay(cellDate);
          const leaveCategory = isLeave ? getLeaveCategory(key) : "";

          const cell = document.createElement("div");
          cell.className = [
            "cal-cell",
            other ? "other-month" : "",
            isToday ? "today" : "",
            isLeave ? "is-leave" : "",
            isRecurringLeave ? "is-leave-recurring" : "",
            isWfh ? "is-wfh" : "",
            logs.length ? "has-data" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const dn = document.createElement("div");
          dn.className = "day-num";
          dn.textContent = day;
          cell.appendChild(dn);

          if (isLeave && !other) {
            const lb = document.createElement("div");
            lb.className = `leave-badge${isRecurringLeave ? " recurring" : ""}`;
            lb.textContent = leaveCategory || "Weekly Off";
            cell.appendChild(lb);
          } else if (isWfh && !other) {
            const wb = document.createElement("div");
            wb.className = "wfh-badge";
            wb.textContent = "WFH";
            cell.appendChild(wb);
          }

    if (logs.length) {
      const ev = document.createElement("div");
      ev.className = "cell-events";
      [...logs]
        .sort((a, b) => {
          if (a[TYPE_COL] !== b[TYPE_COL]) {
            return a[TYPE_COL] === "IN" ? -1 : 1;
          }
          return a._date - b._date;
        })
        .slice(0, 2)
        .forEach((l) => {
        const isIn = l[TYPE_COL] === "IN";
        const p = document.createElement("div");
        p.className = "cell-pill " + (isIn ? "in" : "out");
        p.innerHTML = `<div class="cell-pill-dot"></div><span class="pill-text">${isIn ? "In" : "Out"} ${formatTime(l._date)}</span>`;
        ev.appendChild(p);
      });
            if (logs.length > 2) {
              const m = document.createElement("div");
              m.className = "cell-more";
              m.textContent = `+${logs.length - 2}`;
              ev.appendChild(m);
            }
            cell.appendChild(ev);
          }

          if (logs.length || (!other && (isLeave || isWfh))) {
            cell.classList.add("has-data");
            cell.addEventListener("click", () => {
              if (selectedCell) selectedCell.classList.remove("selected");
              selectedCell = cell;
              cell.classList.add("selected");
              showDetail(cellDate, logs);
            });
          }
          grid.appendChild(cell);
        }
      }

      function showDetail(date, logs) {
        detailCurrentDate = date;
        const k = dateKey(date);
        const dayStatus = getDayStatus(date);
        $("detailDate").textContent =
          formatFullDate(date) +
          (dayStatus === "LEAVE"
            ? " — Leave"
            : dayStatus === "WFH"
              ? " — WFH"
              : "");
        $("detailCount").textContent =
          `${logs.length} event${logs.length !== 1 ? "s" : ""}`;

        const dab = $("detailAddBtn");
        dab.onclick = async () => {
          if (!adminUnlocked) {
            const ok = await openPinModal();
            if (!ok) return;
            adminUnlocked = true;
            updateStrip();
          }
          openAddModal(k);
        };

        const list = $("detailList");
        list.innerHTML = "";
        [...logs]
          .sort((a, b) => a._date - b._date)
          .forEach((log) => {
            const isIn = log[TYPE_COL] === "IN";
            const li = document.createElement("li");
            li.className = "detail-item " + (isIn ? "in" : "out");
            const btn = document.createElement("button");
            btn.className = "delete-btn" + (adminUnlocked ? "" : " locked");
            btn.innerHTML = trashSVG() + " Delete";
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              deleteLog(log.id, btn, li);
            });
            li.innerHTML = `<div class="detail-dot"></div><div class="detail-info"><div class="detail-type">${isIn ? "Check In" : "Check Out"}</div><div class="detail-time">${formatTime(log._date)}</div></div>`;
            li.appendChild(btn);
            list.appendChild(li);
          });

        if (!logs.length && dayStatus) {
          const li = document.createElement("li");
          li.style.cssText = `padding:12px;font-size:12px;color:${dayStatus === "LEAVE" ? "var(--leave)" : "var(--wfh)"};text-align:center;`;
          if (dayStatus === "LEAVE") {
            const category = getLeaveCategory(k);
            const label = getLeaveDateLabel(k);
            li.textContent = category
              ? `${category}${label ? ` — ${label}` : ""}`
              : label
                ? `Weekly Off — ${label}`
                : "Weekly Off";
          } else {
            li.textContent = "Marked as WFH day — no attendance records";
          }
          list.appendChild(li);
        }

        const panel = $("detailPanel");
        panel.classList.add("visible");
        updateStrip();
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      function closeDetail() {
        $("detailPanel").classList.remove("visible");
        detailCurrentDate = null;
        if (selectedCell) {
          selectedCell.classList.remove("selected");
          selectedCell = null;
        }
      }

      $("prevMonth").addEventListener("click", () => {
        if (viewMonth === 0) {
          viewMonth = 11;
          viewYear--;
        } else {
          viewMonth--;
        }
        closeDetail();
        renderAll();
      });

      $("nextMonth").addEventListener("click", () => {
        if (viewMonth === 11) {
          viewMonth = 0;
          viewYear++;
        } else {
          viewMonth++;
        }
        closeDetail();
        renderAll();
      });

      $("detailClose").addEventListener("click", closeDetail);

      bindDateInputPicker("addDate");
      bindDateInputPicker("leaveDateInput");
      bindDateInputPicker("wfhDateInput");

      loadData();
      updateStrip();
    