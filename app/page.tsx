import Script from "next/script";

const attendanceMarkup = String.raw`<div class="overlay" id="pinOverlay">
      <div class="pin-modal">
        <div class="pin-modal-header">
          <div class="pin-lock-icon">🔐</div>
          <h2>Admin PIN</h2>
        </div>
        <p>Enter your PIN to unlock admin mode for this session.</p>
        <div class="pin-dots" id="pinDots">
          <div class="pin-dot" id="pd0"></div>
          <div class="pin-dot" id="pd1"></div>
          <div class="pin-dot" id="pd2"></div>
          <div class="pin-dot" id="pd3"></div>
        </div>
        <div class="pin-keypad" id="pinKeypad">
          <button class="pin-key" data-k="1">1</button>
          <button class="pin-key" data-k="2">2</button>
          <button class="pin-key" data-k="3">3</button>
          <button class="pin-key" data-k="4">4</button>
          <button class="pin-key" data-k="5">5</button>
          <button class="pin-key" data-k="6">6</button>
          <button class="pin-key" data-k="7">7</button>
          <button class="pin-key" data-k="8">8</button>
          <button class="pin-key" data-k="9">9</button>
          <button class="pin-key wide" data-k="0">0</button>
          <button class="pin-key del-key" data-k="del">⌫</button>
        </div>
        <div class="pin-error-msg" id="pinError"></div>
        <button class="pin-cancel" id="pinCancel">Cancel</button>
      </div>
    </div>

    <div class="overlay" id="addOverlay">
      <div class="add-modal">
        <div class="add-modal-header">
          <h2>Add Attendance</h2>
          <button class="modal-close" id="addClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-input" id="addDate" />
        </div>
        <div class="form-group">
          <label class="form-label">Time</label>
          <input type="time" class="form-input" id="addTime" />
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <div class="type-toggle">
            <button
              class="type-btn active-in"
              id="typeIn"
              onclick="selectType('IN')"
            >
              ✓ Check In
            </button>
            <button class="type-btn" id="typeOut" onclick="selectType('OUT')">
              Check Out
            </button>
          </div>
        </div>
        <button class="add-submit" id="addSubmit" onclick="submitLog()">
          Add Record
        </button>
        <div class="add-msg" id="addMsg"></div>
      </div>
    </div>

    <div class="overlay" id="leaveOverlay">
      <div class="leave-modal">
        <div class="leave-modal-header">
          <h2>Manage Leave</h2>
          <button class="modal-close" id="leaveClose">✕</button>
        </div>
        <p class="sub modal-admin-only" id="leaveAdminSub">
          Set weekly off-days and one-off leave dates from a single place.
        </p>
        <p class="readonly-note" id="leaveReadonlyNote">
          Unlock admin mode to add or edit leave entries.
        </p>
        <div class="modal-admin-only" id="leaveAdminControls">
          <div class="leave-section-title">Recurring Weekdays</div>
          <div class="weekday-grid" id="weekdayGrid">
            <button class="wd-btn" data-wd="0">Sun</button>
            <button class="wd-btn" data-wd="1">Mon</button>
            <button class="wd-btn" data-wd="2">Tue</button>
            <button class="wd-btn" data-wd="3">Wed</button>
            <button class="wd-btn" data-wd="4">Thu</button>
            <button class="wd-btn" data-wd="5">Fri</button>
            <button class="wd-btn" data-wd="6">Sat</button>
          </div>

          <div class="leave-section-title">Specific Dates</div>
          <div class="leave-date-row">
            <input type="date" class="form-input" id="leaveDateInput" />
            <select class="form-input" id="leaveCategoryInput">
              <option value="">Leave Category</option>
              <option value="Earned Leave">Earned Leave</option>
              <option value="Casual Leave">Casual Leave</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Compensatory Off">Compensatory Off</option>
              <option value="Public Holidays">Public Holidays</option>
              <option value="Restricted Holidays">Restricted Holidays</option>
              <option value="Loss of Pay (LOP)">Loss of Pay (LOP)</option>
            </select>
          </div>
          <div class="leave-date-row">
            <input
              type="text"
              class="form-input"
              id="leaveLabelInput"
              placeholder="Optional note (e.g. Holi)"
            />
            <button class="leave-add-btn" onclick="addSpecificLeave()">
              + Add
            </button>
          </div>
        </div>
        <ul class="leave-list" id="leaveList"></ul>
        <button class="list-toggle" id="leaveListToggle" style="display: none">
          Show all
        </button>

        <button class="leave-save-btn modal-admin-only" id="leaveSaveBtn" onclick="saveLeaveSettings()">
          Save Settings
        </button>
      </div>
    </div>

    <div class="overlay" id="wfhOverlay">
      <div class="wfh-modal">
        <div class="wfh-modal-header">
          <h2>Manage WFH</h2>
          <button class="modal-close" id="wfhClose">✕</button>
        </div>
        <p class="sub modal-admin-only" id="wfhAdminSub">Set one-off WFH dates.</p>
        <p class="readonly-note" id="wfhReadonlyNote">
          Unlock admin mode to add or edit WFH entries.
        </p>
        <div class="modal-admin-only" id="wfhAdminControls">
          <div class="leave-section-title">Specific Dates</div>
          <div class="wfh-date-row">
            <input type="date" class="form-input" id="wfhDateInput" />
            <button class="wfh-add-btn" onclick="addSpecificWfh()">+ Add</button>
          </div>
        </div>
        <ul class="wfh-list" id="wfhList"></ul>
        <button class="list-toggle" id="wfhListToggle" style="display: none">
          Show all
        </button>

        <button class="wfh-save-btn modal-admin-only" id="wfhSaveBtn" onclick="saveWfhSettings()">
          Save Settings
        </button>
      </div>
    </div>

    <div id="loading" class="loading">
      <div class="spinner"></div>
      <span>LOADING</span>
    </div>
    <div id="errorBox" class="error-box">
      <h3>⚠ Could not load attendance data</h3>
      <p id="errorMsg"></p>
      <code id="errorDetail" style="display: none"></code>
      <button class="retry-btn" onclick="loadData()">Retry</button>
    </div>
    <div id="emptyState" class="empty-state">
      <div class="empty-icon">○</div>
      <p>No attendance records found.</p>
    </div>

    <div id="app">
      <div class="header">
        <div class="header-left">
          <h1>Attendance</h1>
          <p>Office check-in & check-out log</p>
        </div>
        <div class="header-right">
          <div class="legend">
            <div class="legend-item">
              <div class="legend-dot" style="background: var(--in)"></div>
              In
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background: var(--out)"></div>
              Out
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background: var(--leave)"></div>
              Leave
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background: var(--wfh)"></div>
              WFH
            </div>
          </div>
          <div class="month-nav">
            <button id="prevMonth">&#8249;</button>
            <span class="month-label" id="monthLabel"></span>
            <button id="nextMonth">&#8250;</button>
          </div>
        </div>
      </div>

      <div class="admin-strip fade-in" id="adminStrip">
        <div class="strip-dot"></div>
        <span class="strip-label" id="stripLabel"
          >🔒 Locked — unlock to add or delete records</span
        >
        <div class="strip-actions">
          <button class="strip-action leave-btn" id="leaveBtn">
            Leave
          </button>
          <button class="strip-action wfh-btn" id="wfhBtn">
            WFH
          </button>
          <button class="strip-action" id="stripBtn">Unlock</button>
        </div>
      </div>

      <div class="stats fade-in">
        <div class="stat-card">
          <div class="stat-label">Days Present</div>
          <div class="stat-value" id="stat-days">—</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Leave Days</div>
          <div class="stat-value yellow" id="stat-leave">—</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">WFH Days</div>
          <div class="stat-value blue" id="stat-wfh">—</div>
        </div>
      </div>

      <div class="cal-card fade-in">
        <div class="cal-head">
          <div class="cal-head-cell">Sun</div>
          <div class="cal-head-cell">Mon</div>
          <div class="cal-head-cell">Tue</div>
          <div class="cal-head-cell">Wed</div>
          <div class="cal-head-cell">Thu</div>
          <div class="cal-head-cell">Fri</div>
          <div class="cal-head-cell">Sat</div>
        </div>
        <div class="cal-grid" id="calGrid"></div>
      </div>

      <div class="detail-panel fade-in" id="detailPanel">
        <div class="detail-header">
          <div class="detail-date" id="detailDate"></div>
          <div class="detail-meta">
            <span class="detail-count" id="detailCount"></span>
            <button class="detail-close" id="detailClose">✕</button>
          </div>
        </div>
        <div class="detail-actions">
          <button class="detail-add-btn locked" id="detailAddBtn">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path
                d="M5.5 2v7M2 5.5h7"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
            Add Record
          </button>
        </div>
        <ul class="detail-list" id="detailList"></ul>
      </div>
    </div>`;

export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: attendanceMarkup }} />
      <Script src="/attendance-app.js" strategy="afterInteractive" />
    </>
  );
}
