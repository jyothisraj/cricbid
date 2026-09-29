// =====================================================
// Eminent Super League - Multi-Auction System Backend
// Deploy this as a Google Apps Script Web App
// =====================================================

const EVENTS_SHEET = 'Events';
const TEAMS_SHEET = 'Teams';
const SETTINGS_SHEET = 'Settings';
const AUCTION_LOG_SHEET = 'AuctionLog';
const DRIVE_BASE_FOLDER_ID = '1YdBiEy8ENXQOmuVJy6lxvpDSbQXYOyKn';

// ---- Spreadsheet Menu for Easy 1-Click Authorization ----
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🏏 CricBid')
      .addItem('🔐 Authorize Google Drive & Test', 'testDriveAuth')
      .addToUi();
  } catch (e) {}
}

// Direct call with write test so Google Apps Script engine detects and prompts for full Drive Write access (https://www.googleapis.com/auth/drive):
function testDriveAuth() {
  const folder = DriveApp.getFolderById(DRIVE_BASE_FOLDER_ID);
  
  // Test write permission: create and trash a small test file so Google requires the full write scope
  const testFile = folder.createFile('.cricbid_auth_test.tmp', 'write_test', MimeType.PLAIN_TEXT);
  testFile.setTrashed(true);

  const msg = 'Drive Full Read & Write access OK! Base folder: ' + folder.getName();
  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert('✅ Success', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {}
  return folder.getName();
}

// ---- Initialization: Create sheets and update headers if needed ----
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Events Sheet
  if (!ss.getSheetByName(EVENTS_SHEET)) {
    const es = ss.insertSheet(EVENTS_SHEET);
    es.appendRow([
      'Event Name', 'Event Code', 'Start Date', 'End Date', 
      'Venue', 'Registration Fee', 'Event Contacts', 'Banner URL', 
      'Status', 'Created At'
    ]);
    es.getRange('1:1').setFontWeight('bold');
    
    // Seed default ESL 2026 event
    es.appendRow([
      'Eminent Super League 2026', 'ESL2026', '2026-03-01', '2026-03-31',
      'Sports Arena', 'Free', 'admin@eminentsuperleague.com', 'img/logo-red.png',
      'Live', new Date().toISOString()
    ]);
  }

  // 2. Teams Sheet
  let ts = ss.getSheetByName(TEAMS_SHEET);
  if (!ts) {
    ts = ss.insertSheet(TEAMS_SHEET);
    ts.appendRow(['Team Name', 'Logo URL', 'Owner Name', 'Icon Player', 'Username', 'Password', 'Purse Remaining', 'Max Players', 'EventCode']);
    ts.getRange('1:1').setFontWeight('bold');
  } else {
    // Check if Event Code column exists anywhere in header
    const rawHeaders = ts.getRange('1:1').getValues()[0];
    const cleanHeaders = rawHeaders.map(h => String(h || '').toLowerCase().replace(/[\s_-]/g, ''));
    if (!cleanHeaders.includes('eventcode') && !cleanHeaders.includes('event')) {
      ts.insertColumnBefore(1);
      ts.getRange(1, 1).setValue('Event Code').setFontWeight('bold');
      // Set existing teams to default ESL2026
      const lastRow = ts.getLastRow();
      if (lastRow > 1) {
        for (let r = 2; r <= lastRow; r++) {
          if (!ts.getRange(r, 1).getValue()) {
            ts.getRange(r, 1).setValue('ESL2026');
          }
        }
      }
    }
  }

  // 3. Settings Sheet
  if (!ss.getSheetByName(SETTINGS_SHEET)) {
    const st = ss.insertSheet(SETTINGS_SHEET);
    st.appendRow(['Key', 'Value']);
    st.appendRow(['apps_script_url', '']);
    st.appendRow(['firebase_url', '']);
    st.appendRow(['access_code', 'ESL2026']);
    st.appendRow(['min_player_value', '10000']);
    st.appendRow(['budget_per_team', '1000000']);
    st.appendRow(['max_players_per_team', '11']);
    st.appendRow(['timer_seconds', '30']);
    st.appendRow(['timer_increment', '10']);
    st.appendRow(['auction_status', 'stopped']);
    st.getRange('1:1').setFontWeight('bold');
  }

  // 4. AuctionLog Sheet
  let al = ss.getSheetByName(AUCTION_LOG_SHEET);
  if (!al) {
    al = ss.insertSheet(AUCTION_LOG_SHEET);
    al.appendRow(['Event Code', 'Player Name', 'Status', 'Team', 'Price', 'Timestamp']);
    al.getRange('1:1').setFontWeight('bold');
  } else {
    const headers = al.getRange('1:1').getValues()[0];
    if (headers.length > 0 && headers[0].toString().toLowerCase().trim() !== 'event code') {
      al.insertColumnBefore(1);
      al.getRange(1, 1).setValue('Event Code').setFontWeight('bold');
      const lastRow = al.getLastRow();
      if (lastRow > 1) {
        for (let r = 2; r <= lastRow; r++) {
          if (!al.getRange(r, 1).getValue()) {
            al.getRange(r, 1).setValue('ESL2026');
          }
        }
      }
    }
  }
}

// ---- GET handler ----
function doGet(e) {
  initSheets();
  const params = (e && e.parameter) || {};
  const action = params.action || '';
  const eventCode = params.eventCode || params.eventcode || params.event || '';
  let result;

  try {
    switch (action) {
      case 'getEvents':
        result = getEvents();
        break;
      case 'getTeams':
        result = getTeams(eventCode);
        break;
      case 'getSettings':
        result = getSettings(eventCode);
        break;
      case 'getAuctionLog':
        result = getAuctionLog(eventCode);
        break;
      case 'getPlayers':
        result = getPlayers(eventCode);
        break;
      case 'authenticate':
        result = authenticate(params.username, params.password, eventCode);
        break;
      case 'getDashboard':
        result = getDashboard(params.teamName, eventCode);
        break;
      case 'init':
        result = { success: true, message: 'Sheets initialized for multi-event auctions' };
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- POST handler ----
function doPost(e) {
  initSheets();
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid JSON' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const action = data.action || '';
  let result;

  try {
    switch (action) {
      // Event operations
      case 'addEvent':
        result = addEvent(data);
        break;
      case 'updateEvent':
        result = updateEvent(data);
        break;
      case 'deleteEvent':
        result = deleteEvent(data.eventCode);
        break;

      // Team operations
      case 'addTeam':
        result = addTeam(data);
        break;
      case 'deleteTeam':
        result = deleteTeam(data.teamName, data.eventCode);
        break;
      case 'updateTeam':
        result = updateTeam(data);
        break;

      // Player operations
      case 'addPlayer':
        result = addPlayer(data);
        break;
      case 'updatePlayer':
        result = updatePlayer(data);
        break;
      case 'deletePlayer':
        result = deletePlayer(data.playerName || data.name, data.eventCode);
        break;

      // Settings operations
      case 'updateSettings':
        result = updateSettings(data.settings, data.eventCode);
        break;

      // Auction manager operations
      case 'soldPlayer':
        result = soldPlayer(data);
        break;
      case 'unsoldPlayer':
        result = unsoldPlayer(data);
        break;
      case 'passPlayer':
        result = passPlayer(data);
        break;
      case 'reenterPlayer':
        result = reenterPlayer(data);
        break;
      case 'reenterAllUnsold':
        result = reenterAllUnsold(data.eventCode);
        break;
      case 'setCurrentPlayer':
        result = setCurrentPlayer(data);
        break;
      case 'updateBid':
        result = updateBid(data);
        break;
      case 'resetAuction':
        result = resetAuction(data.eventCode);
        break;
      case 'uploadFile':
        result = uploadFile(data);
        break;

      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================== EVENTS =====================

function getEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) return { events: [] };
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { events: [] };

  const events = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[1]) continue;
    events.push({
      eventName: String(row[0] || '').trim(),
      eventCode: String(row[1] || '').trim().toUpperCase(),
      startDate: row[2] ? formatDate(row[2]) : '',
      endDate: row[3] ? formatDate(row[3]) : '',
      venue: String(row[4] || '').trim(),
      registrationFee: String(row[5] || '').trim(),
      eventContacts: String(row[6] || '').trim(),
      bannerUrl: String(row[7] || '').trim(),
      status: String(row[8] || 'Active').trim(),
      createdAt: row[9] || ''
    });
  }
  return { events };
}

function formatDate(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

function addEvent(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EVENTS_SHEET);
  const code = (data.eventCode || '').trim().toUpperCase();
  if (!code) return { error: 'Event code is required' };
  if (!data.eventName) return { error: 'Event name is required' };

  const existing = getEvents().events;
  for (const ev of existing) {
    if (ev.eventCode === code) return { error: 'Event code "' + code + '" already exists' };
  }

  sheet.appendRow([
    data.eventName || '',
    code,
    data.startDate || '',
    data.endDate || '',
    data.venue || '',
    data.registrationFee || '',
    data.eventContacts || '',
    data.bannerUrl || '',
    data.status || 'Active',
    new Date().toISOString()
  ]);

  return { success: true, eventCode: code };
}

function updateEvent(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EVENTS_SHEET);
  const code = (data.eventCode || '').trim().toUpperCase();
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1] || '').trim().toUpperCase() === code) {
      const rowIdx = i + 1;
      if (data.eventName !== undefined) sheet.getRange(rowIdx, 1).setValue(data.eventName);
      if (data.startDate !== undefined) sheet.getRange(rowIdx, 3).setValue(data.startDate);
      if (data.endDate !== undefined) sheet.getRange(rowIdx, 4).setValue(data.endDate);
      if (data.venue !== undefined) sheet.getRange(rowIdx, 5).setValue(data.venue);
      if (data.registrationFee !== undefined) sheet.getRange(rowIdx, 6).setValue(data.registrationFee);
      if (data.eventContacts !== undefined) sheet.getRange(rowIdx, 7).setValue(data.eventContacts);
      if (data.bannerUrl !== undefined) sheet.getRange(rowIdx, 8).setValue(data.bannerUrl);
      if (data.status !== undefined) sheet.getRange(rowIdx, 9).setValue(data.status);
      return { success: true };
    }
  }
  return { error: 'Event not found: ' + code };
}

function deleteEvent(eventCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EVENTS_SHEET);
  const code = (eventCode || '').trim().toUpperCase();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim().toUpperCase() === code) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Event not found' };
}

// ===================== TEAMS =====================

function getTeams(eventCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TEAMS_SHEET);
  if (!sheet) return { teams: [] };
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { teams: [] };

  const rawHeaders = data[0].map(h => String(h || '').trim());
  const colMap = {};
  for (let c = 0; c < rawHeaders.length; c++) {
    const k = rawHeaders[c].toLowerCase().replace(/[\s_-]/g, '');
    if (k) colMap[k] = c;
  }

  const getCol = (names, fallbackIdx) => {
    for (const n of names) {
      if (colMap[n] !== undefined) return colMap[n];
    }
    return fallbackIdx;
  };

  const cTeam = getCol(['teamname', 'team'], 0);
  const cLogo = getCol(['logourl', 'logo'], 1);
  const cOwner = getCol(['ownername', 'owner'], 2);
  const cIcon = getCol(['iconplayer', 'icon'], 3);
  const cUser = getCol(['username', 'user'], 4);
  const cPass = getCol(['password', 'pass'], 5);
  const cPurse = getCol(['purseremaining', 'purse', 'budget'], 6);
  const cMax = getCol(['maxplayers', 'maxplayer'], 7);
  const cEvent = getCol(['eventcode', 'event'], colMap['eventcode'] !== undefined ? colMap['eventcode'] : (colMap['event'] !== undefined ? colMap['event'] : -1));
  const cRetained = getCol(['retainedplayer', 'retained', 'retainedplayers'], -1);

  const filterCode = (eventCode || '').trim().toUpperCase();
  const teams = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const teamName = String(row[cTeam] || '').trim();
    if (!teamName) continue;

    const rowEvCode = cEvent !== -1 ? String(row[cEvent] || '').trim().toUpperCase() : '';
    const effectiveEvCode = rowEvCode || 'ESL2026';

    if (filterCode && filterCode !== 'ALL' && effectiveEvCode !== filterCode) continue;

    teams.push({
      eventCode: effectiveEvCode,
      teamName: teamName,
      logoUrl: row[cLogo] || '',
      ownerName: row[cOwner] || '',
      iconPlayer: row[cIcon] || '',
      retainedPlayer: cRetained !== -1 ? (row[cRetained] || '') : '',
      username: row[cUser] || '',
      password: row[cPass] || '',
      purseRemaining: parseFloat(row[cPurse]) || 0,
      maxPlayers: parseInt(row[cMax]) || 11
    });
  }
  return { teams };
}

function addTeam(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TEAMS_SHEET);
  const eventCode = (data.eventCode || 'ESL2026').trim().toUpperCase();
  const settings = getSettings(eventCode).settings;
  const budget = parseFloat(settings.budget_per_team) || 1000000;
  const maxP = parseInt(settings.max_players_per_team) || 11;

  // Check for duplicate team name or username within the same event
  const existing = getTeams(eventCode).teams;
  for (const t of existing) {
    if (t.teamName.toLowerCase() === (data.teamName || '').toLowerCase().trim()) {
      return { error: 'Team name already exists in this event (' + eventCode + ')' };
    }
    if (t.username.toLowerCase() === (data.username || '').toLowerCase().trim()) {
      return { error: 'Username already exists' };
    }
  }

  const rawHeaders = sheet.getRange('1:1').getValues()[0].map(h => String(h || '').trim());
  let evColIdx = -1;
  for (let c = 0; c < rawHeaders.length; c++) {
    const k = rawHeaders[c].toLowerCase().replace(/[\s_-]/g, '');
    if (k === 'eventcode' || k === 'event') {
      evColIdx = c;
      break;
    }
  }

  // If no EventCode column exists in headers, append it at the end
  if (evColIdx === -1) {
    const lastCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, lastCol).setValue('EventCode').setFontWeight('bold');
    evColIdx = lastCol - 1;
    rawHeaders.push('EventCode');
  }

  const newRow = new Array(rawHeaders.length).fill('');
  for (let c = 0; c < rawHeaders.length; c++) {
    const k = rawHeaders[c].toLowerCase().replace(/[\s_-]/g, '');
    if (k === 'teamname' || k === 'team') newRow[c] = data.teamName || '';
    else if (k === 'logourl' || k === 'logo') newRow[c] = data.logoUrl || '';
    else if (k === 'ownername' || k === 'owner') newRow[c] = data.ownerName || '';
    else if (k === 'iconplayer' || k === 'icon') newRow[c] = data.iconPlayer || '';
    else if (k === 'retainedplayer' || k === 'retained' || k === 'retainedplayers') newRow[c] = data.retainedPlayer || '';
    else if (k === 'username' || k === 'user') newRow[c] = data.username || '';
    else if (k === 'password' || k === 'pass') newRow[c] = data.password || '';
    else if (k === 'purseremaining' || k === 'purse' || k === 'budget') newRow[c] = (data.purseRemaining !== undefined && data.purseRemaining !== '') ? data.purseRemaining : budget;
    else if (k === 'maxplayers' || k === 'maxplayer') newRow[c] = maxP;
    else if (k === 'eventcode' || k === 'event') newRow[c] = eventCode;
  }

  sheet.appendRow(newRow);
  return { success: true };
}

function deleteTeam(teamName, eventCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TEAMS_SHEET);
  const data = sheet.getDataRange().getValues();
  const filterCode = (eventCode || '').trim().toUpperCase();

  const rawHeaders = data[0].map(h => String(h || '').trim());
  let evColIdx = -1;
  let teamColIdx = 0;
  for (let c = 0; c < rawHeaders.length; c++) {
    const k = rawHeaders[c].toLowerCase().replace(/[\s_-]/g, '');
    if (k === 'eventcode' || k === 'event') evColIdx = c;
    if (k === 'teamname' || k === 'team') teamColIdx = c;
  }

  for (let i = 1; i < data.length; i++) {
    const tName = String(data[i][teamColIdx] || '').trim().toLowerCase();
    const rowCode = evColIdx !== -1 ? (String(data[i][evColIdx] || '').trim().toUpperCase() || 'ESL2026') : 'ESL2026';

    if (tName === (teamName || '').toLowerCase().trim()) {
      if (!filterCode || filterCode === 'ALL' || rowCode === filterCode) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
  }
  return { error: 'Team not found' };
}

function updateTeam(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TEAMS_SHEET);
  const rows = sheet.getDataRange().getValues();
  const filterCode = (data.eventCode || '').trim().toUpperCase();

  const rawHeaders = rows[0].map(h => String(h || '').trim());
  const colMap = {};
  for (let c = 0; c < rawHeaders.length; c++) {
    const k = rawHeaders[c].toLowerCase().replace(/[\s_-]/g, '');
    if (k) colMap[k] = c;
  }

  const teamColIdx = colMap['teamname'] !== undefined ? colMap['teamname'] : (colMap['team'] !== undefined ? colMap['team'] : 0);
  const evColIdx = colMap['eventcode'] !== undefined ? colMap['eventcode'] : (colMap['event'] !== undefined ? colMap['event'] : -1);

  for (let i = 1; i < rows.length; i++) {
    const tName = String(rows[i][teamColIdx] || '').trim().toLowerCase();
    const rowCode = evColIdx !== -1 ? (String(rows[i][evColIdx] || '').trim().toUpperCase() || 'ESL2026') : 'ESL2026';

    if (tName === (data.teamName || '').toLowerCase().trim()) {
      if (!filterCode || filterCode === 'ALL' || rowCode === filterCode) {
        const rowIdx = i + 1;
        const setVal = (keys, val) => {
          if (val === undefined) return;
          for (const k of keys) {
            if (colMap[k] !== undefined) {
              sheet.getRange(rowIdx, colMap[k] + 1).setValue(val);
              return;
            }
          }
        };
        setVal(['logourl', 'logo'], data.logoUrl);
        setVal(['ownername', 'owner'], data.ownerName);
        setVal(['iconplayer', 'icon'], data.iconPlayer);
        setVal(['retainedplayer', 'retained', 'retainedplayers'], data.retainedPlayer);
        setVal(['username', 'user'], data.username);
        setVal(['password', 'pass'], data.password);
        setVal(['purseremaining', 'purse'], data.purseRemaining);
        setVal(['maxplayers', 'maxplayer'], data.maxPlayers);
        if (data.newEventCode) setVal(['eventcode', 'event'], data.newEventCode);
        return { success: true };
      }
    }
  }
  return { error: 'Team not found' };
}


// ===================== SETTINGS =====================

function getSettings(eventCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  const data = sheet.getDataRange().getValues();
  const settings = {};
  const evPrefix = (eventCode || '').trim().toUpperCase();

  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0] || '');
    const val = data[i][1] !== undefined ? String(data[i][1]) : '';
    if (key) {
      settings[key] = val;
      // Also look for event-prefixed overrides e.g. ESL2026_budget_per_team
      if (evPrefix && key.startsWith(evPrefix + '_')) {
        const cleanKey = key.substring(evPrefix.length + 1);
        settings[cleanKey] = val;
      }
    }
  }
  return { settings };
}

function updateSettings(newSettings, eventCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  const data = sheet.getDataRange().getValues();
  const evPrefix = (eventCode || '').trim().toUpperCase();

  for (const rawKey of Object.keys(newSettings)) {
    // If eventCode given and key is budget/timer etc, store with prefix or standard
    const key = rawKey;
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(newSettings[rawKey]);
        data[i][1] = newSettings[rawKey];
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, newSettings[rawKey]]);
    }
  }

  // If budget changed, update all teams' purse for this event
  if (newSettings.budget_per_team !== undefined) {
    updateAllTeamPurses(eventCode);
  }

  return { success: true };
}

function updateAllTeamPurses(eventCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settings = getSettings(eventCode).settings;
  const budget = parseFloat(settings.budget_per_team) || 1000000;
  const log = getAuctionLog(eventCode).log;
  const teamSheet = ss.getSheetByName(TEAMS_SHEET);
  const rows = teamSheet.getDataRange().getValues();
  if (rows.length <= 1) return;

  const rawHeaders = rows[0].map(h => String(h || '').trim());
  let evColIdx = -1;
  for (let c = 0; c < rawHeaders.length; c++) {
    const k = rawHeaders[c].toLowerCase().replace(/[\s_-]/g, '');
    if (k === 'eventcode' || k === 'event') {
      evColIdx = c;
      break;
    }
  }

  const offset = (evColIdx === 0) ? 1 : 0;
  const filterCode = (eventCode || '').trim().toUpperCase();

  for (let i = 1; i < rows.length; i++) {
    const tName = rows[i][offset];
    const rowCode = evColIdx !== -1 ? String(rows[i][evColIdx] || '').trim().toUpperCase() : '';
    if (filterCode && rowCode && rowCode !== filterCode) continue;

    const spent = log
      .filter(l => l.team === tName && l.status === 'Sold')
      .reduce((sum, l) => sum + (parseFloat(l.price) || 0), 0);
    teamSheet.getRange(i + 1, offset + 7).setValue(budget - spent);
  }
}


// ===================== AUCTION LOG =====================

function getAuctionLog(eventCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AUCTION_LOG_SHEET);
  if (!sheet) return { log: [] };
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { log: [] };

  const hasEventCodeCol = String(data[0][0] || '').trim().toLowerCase() === 'event code';
  const filterCode = (eventCode || '').trim().toUpperCase();
  const offset = hasEventCodeCol ? 1 : 0;

  const logEntries = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowCode = hasEventCodeCol ? String(row[0] || '').trim().toUpperCase() : '';
    if (filterCode && rowCode && rowCode !== filterCode) continue;

    const playerName = row[offset + 0] || '';
    if (!playerName) continue;

    logEntries.push({
      eventCode: rowCode || filterCode || 'ESL2026',
      playerName: playerName,
      status: row[offset + 1] || '',
      team: row[offset + 2] || '',
      price: parseFloat(row[offset + 3]) || 0,
      timestamp: row[offset + 4] || ''
    });
  }
  return { log: logEntries };
}

function soldPlayer(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(AUCTION_LOG_SHEET);
  const eventCode = (data.eventCode || 'ESL2026').trim().toUpperCase();

  // Remove existing entry for this player if re-auctioning
  removePlayerFromLog(data.playerName, eventCode);

  const hasEventCodeCol = String(logSheet.getRange('A1').getValue() || '').trim().toLowerCase() === 'event code';
  if (hasEventCodeCol) {
    logSheet.appendRow([
      eventCode,
      data.playerName,
      'Sold',
      data.teamName,
      parseFloat(data.price) || 0,
      new Date().toISOString()
    ]);
  } else {
    logSheet.appendRow([
      data.playerName,
      'Sold',
      data.teamName,
      parseFloat(data.price) || 0,
      new Date().toISOString()
    ]);
  }

  // Deduct team purse
  const teamSheet = ss.getSheetByName(TEAMS_SHEET);
  const rows = teamSheet.getDataRange().getValues();
  const rawHeaders = rows[0].map(h => String(h || '').trim());
  let evColIdx = -1;
  let teamColIdx = 0;
  let purseColIdx = 6;
  for (let c = 0; c < rawHeaders.length; c++) {
    const k = rawHeaders[c].toLowerCase().replace(/[\s_-]/g, '');
    if (k === 'eventcode' || k === 'event') evColIdx = c;
    if (k === 'teamname' || k === 'team') teamColIdx = c;
    if (k === 'purseremaining' || k === 'purse' || k === 'budget') purseColIdx = c;
  }

  for (let i = 1; i < rows.length; i++) {
    const tName = String(rows[i][teamColIdx] || '').trim().toLowerCase();
    const rowCode = evColIdx !== -1 ? (String(rows[i][evColIdx] || '').trim().toUpperCase() || 'ESL2026') : 'ESL2026';
    if (tName === (data.teamName || '').toLowerCase().trim() && (!eventCode || eventCode === 'ALL' || rowCode === eventCode)) {
      const currentPurse = parseFloat(rows[i][purseColIdx]) || 0;
      teamSheet.getRange(i + 1, purseColIdx + 1).setValue(currentPurse - (parseFloat(data.price) || 0));
      break;
    }
  }

  // Clear current player from settings
  updateSettings({
    current_player_index: '',
    current_player_name: '',
    current_bid: '0',
    current_bidder: '',
    auction_status: 'waiting'
  }, eventCode);

  return { success: true };
}

function unsoldPlayer(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(AUCTION_LOG_SHEET);
  const eventCode = (data.eventCode || 'ESL2026').trim().toUpperCase();

  removePlayerFromLog(data.playerName, eventCode);

  const hasEventCodeCol = String(logSheet.getRange('A1').getValue() || '').trim().toLowerCase() === 'event code';
  if (hasEventCodeCol) {
    logSheet.appendRow([
      eventCode,
      data.playerName,
      'Unsold',
      '',
      0,
      new Date().toISOString()
    ]);
  } else {
    logSheet.appendRow([
      data.playerName,
      'Unsold',
      '',
      0,
      new Date().toISOString()
    ]);
  }

  updateSettings({
    current_player_index: '',
    current_player_name: '',
    current_bid: '0',
    current_bidder: '',
    auction_status: 'waiting'
  }, eventCode);

  return { success: true };
}

function passPlayer(data) {
  return unsoldPlayer(data);
}

function reenterPlayer(data) {
  const eventCode = (data.eventCode || '').trim().toUpperCase();
  removePlayerFromLog(data.playerName, eventCode);
  return { success: true };
}

function reenterAllUnsold(eventCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AUCTION_LOG_SHEET);
  const rows = sheet.getDataRange().getValues();
  const hasEventCodeCol = String(rows[0][0] || '').trim().toLowerCase() === 'event code';
  const filterCode = (eventCode || '').trim().toUpperCase();
  const statusCol = hasEventCodeCol ? 2 : 1;

  let count = 0;
  for (let i = rows.length - 1; i >= 1; i--) {
    const rowCode = hasEventCodeCol ? String(rows[i][0] || '').trim().toUpperCase() : '';
    if (filterCode && rowCode && rowCode !== filterCode) continue;

    if (rows[i][statusCol] === 'Unsold') {
      sheet.deleteRow(i + 1);
      count++;
    }
  }
  return { success: true, count: count };
}

function removePlayerFromLog(playerName, eventCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AUCTION_LOG_SHEET);
  const data = sheet.getDataRange().getValues();
  const hasEventCodeCol = String(data[0][0] || '').trim().toLowerCase() === 'event code';
  const filterCode = (eventCode || '').trim().toUpperCase();
  const nameCol = hasEventCodeCol ? 1 : 0;
  const statusCol = hasEventCodeCol ? 2 : 1;
  const teamCol = hasEventCodeCol ? 3 : 2;
  const priceCol = hasEventCodeCol ? 4 : 3;

  for (let i = data.length - 1; i >= 1; i--) {
    const rowCode = hasEventCodeCol ? String(data[i][0] || '').trim().toUpperCase() : '';
    if (filterCode && rowCode && rowCode !== filterCode) continue;

    if (data[i][nameCol] === playerName) {
      // Restore purse if was sold
      if (data[i][statusCol] === 'Sold' && data[i][teamCol]) {
        const teamSheet = ss.getSheetByName(TEAMS_SHEET);
        const teamRows = teamSheet.getDataRange().getValues();
        const rawHeaders = teamRows[0].map(h => String(h || '').trim());
        let evColIdx = -1;
        let teamColIdx = 0;
        let purseColIdx = 6;
        for (let c = 0; c < rawHeaders.length; c++) {
          const k = rawHeaders[c].toLowerCase().replace(/[\s_-]/g, '');
          if (k === 'eventcode' || k === 'event') evColIdx = c;
          if (k === 'teamname' || k === 'team') teamColIdx = c;
          if (k === 'purseremaining' || k === 'purse' || k === 'budget') purseColIdx = c;
        }

        for (let j = 1; j < teamRows.length; j++) {
          const tName = String(teamRows[j][teamColIdx] || '').trim().toLowerCase();
          const rowCode = evColIdx !== -1 ? (String(teamRows[j][evColIdx] || '').trim().toUpperCase() || 'ESL2026') : 'ESL2026';
          if (tName === String(data[i][teamCol]).trim().toLowerCase() && (!eventCode || eventCode === 'ALL' || rowCode === eventCode)) {
            const cur = parseFloat(teamRows[j][purseColIdx]) || 0;
            teamSheet.getRange(j + 1, purseColIdx + 1).setValue(cur + (parseFloat(data[i][priceCol]) || 0));
            break;
          }
        }
      }
      sheet.deleteRow(i + 1);
    }
  }
}

function setCurrentPlayer(data) {
  return updateSettings({
    current_player_index: String(data.playerIndex || ''),
    current_player_name: data.playerName || '',
    current_bid: String(data.basePrice || '0'),
    current_bidder: '',
    auction_status: 'bidding'
  }, data.eventCode);
}

function updateBid(data) {
  return updateSettings({
    current_bid: String(data.bid || '0'),
    current_bidder: data.teamName || ''
  }, data.eventCode);
}

// ===================== PLAYERS =====================

function getPlayers(eventCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Attendee List') || ss.getSheetByName('AttendeeList') || ss.getSheetByName('Players') || ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { players: [], headers: [] };

  const headers = data[0].map(h => String(h).trim());
  const filterCode = (eventCode || '').trim().toUpperCase();

  // Find eventcode column if exists
  let eventCodeColIdx = -1;
  headers.forEach((h, idx) => {
    const clean = h.toLowerCase().replace(/[\s_-]/g, '');
    if (clean === 'eventcode' || clean === 'event') {
      eventCodeColIdx = idx;
    }
  });

  const players = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const player = {};
    let hasData = false;

    // Filter by eventCode if column exists
    if (filterCode && filterCode !== 'ALL') {
      const rowEvCode = (eventCodeColIdx !== -1 ? String(row[eventCodeColIdx] || '').trim().toUpperCase() : '') || 'ESL2026';
      if (rowEvCode !== 'ALL' && rowEvCode !== filterCode) {
        continue;
      }
    }

    headers.forEach((h, idx) => {
      const val = row[idx] !== null && row[idx] !== undefined ? String(row[idx]) : '';
      player[h] = val;
      if (val.trim()) hasData = true;
    });

    if (hasData) players.push(player);
  }
  return { players, headers };
}

function addPlayer(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Attendee List') || ss.getSheetByName('AttendeeList') || ss.getSheetByName('Players') || ss.getSheets()[0];
  const lastCol = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  
  const colMap = {};
  headers.forEach((h, idx) => {
    colMap[h.toLowerCase().replace(/[\s_-]/g, '')] = idx;
  });

  const row = new Array(headers.length).fill('');
  const setVal = (keys, val) => {
    for (const k of keys) {
      if (colMap[k] !== undefined) {
        row[colMap[k]] = val !== undefined && val !== null ? val : '';
        return;
      }
    }
  };

  setVal(['eventcode', 'event'], (data.eventCode || 'ESL2026').trim().toUpperCase());
  setVal(['name', 'playername', 'player'], data.name || data.playerName || '');
  setVal(['club', 'category'], data.club || data.category || 'General');
  setVal(['mobilenumber', 'mobile', 'phone'], data.mobileNumber || data.mobile || '');
  setVal(['ticketname', 'ticket'], data.ticketName || 'PLAYER REGISTRATION');
  setVal(['ticketprice', 'price', 'baseprice'], data.ticketPrice || data.basePrice || '');
  setVal(['status'], data.status || '');
  setVal(['bookingid', 'id'], data.bookingId || String(Date.now()).slice(-6));
  setVal(['battingprofile', 'battingstyle'], data.battingProfile || data.battingStyle || '');
  setVal(['battingposition', 'position'], data.battingPosition || '');
  setVal(['bowlingprofile', 'bowlingstyle'], data.bowlingProfile || data.bowlingStyle || '');
  setVal(['areyouawicketkeeper', 'wicketkeeper', 'wk'], data.wicketKeeper || data.isWicketKeeper || 'No');
  setVal(['photo', 'image', 'photourl'], data.photo || data.photoUrl || '');
  setVal(['matches'], data.matches || '');
  setVal(['runs'], data.runs || '');
  setVal(["100's", '100s', 'hundreds'], data.hundreds || data["100's"] || '');
  setVal(["50's", '50s', 'fifties'], data.fifties || data["50's"] || '');
  setVal(["30's", '30s', 'thirties'], data.thirties || data["30's"] || '');
  setVal(['sr', 'strikerate'], data.sr || data.strikeRate || '');
  setVal(['avg', 'average'], data.avg || data.average || '');
  setVal(['wickets'], data.wickets || '');
  setVal(['5wkts', '5wickets'], data.fiveWickets || data['5 Wkts'] || '');
  setVal(['3wkts', '3wickets'], data.threeWickets || data['3 Wkts'] || '');
  setVal(['economy', 'econ'], data.economy || '');

  sheet.appendRow(row);
  return { success: true, message: 'Player added successfully', player: data };
}

function updatePlayer(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Attendee List') || ss.getSheetByName('AttendeeList') || ss.getSheetByName('Players') || ss.getSheets()[0];
  const allRows = sheet.getDataRange().getValues();
  if (allRows.length <= 1) return { error: 'No player data found' };

  const headers = allRows[0].map(h => String(h || '').trim());
  const colMap = {};
  headers.forEach((h, idx) => {
    colMap[h.toLowerCase().replace(/[\s_-]/g, '')] = idx;
  });

  const nameCol = colMap['name'] !== undefined ? colMap['name'] : (colMap['playername'] !== undefined ? colMap['playername'] : 1);
  const evCol = colMap['eventcode'] !== undefined ? colMap['eventcode'] : (colMap['event'] !== undefined ? colMap['event'] : -1);

  const origName = (data.origName || data.name || data.playerName || '').trim().toLowerCase();
  const targetEv = (data.eventCode || 'ESL2026').trim().toUpperCase();

  let foundRowIdx = -1;
  for (let i = 1; i < allRows.length; i++) {
    const rowName = String(allRows[i][nameCol] || '').trim().toLowerCase();
    const rowEv = evCol !== -1 ? (String(allRows[i][evCol] || '').trim().toUpperCase() || 'ESL2026') : 'ESL2026';
    if (rowName === origName && (targetEv === 'ALL' || rowEv === targetEv || rowEv === 'ALL')) {
      foundRowIdx = i + 1; // 1-based row index in sheet
      break;
    }
  }

  if (foundRowIdx === -1) {
    return { error: 'Player "' + (data.origName || data.name) + '" not found in sheet' };
  }

  const setCell = (keys, val) => {
    for (const k of keys) {
      if (colMap[k] !== undefined && val !== undefined) {
        sheet.getRange(foundRowIdx, colMap[k] + 1).setValue(val);
        return;
      }
    }
  };

  if (data.name || data.playerName) setCell(['name', 'playername', 'player'], data.name || data.playerName);
  if (data.eventCode) setCell(['eventcode', 'event'], data.eventCode.trim().toUpperCase());
  if (data.club || data.category) setCell(['club', 'category'], data.club || data.category);
  if (data.mobileNumber || data.mobile) setCell(['mobilenumber', 'mobile', 'phone'], data.mobileNumber || data.mobile);
  if (data.ticketName) setCell(['ticketname', 'ticket'], data.ticketName);
  if (data.ticketPrice || data.basePrice) setCell(['ticketprice', 'price', 'baseprice'], data.ticketPrice || data.basePrice);
  if (data.status !== undefined) setCell(['status'], data.status);
  if (data.battingProfile || data.battingStyle) setCell(['battingprofile', 'battingstyle'], data.battingProfile || data.battingStyle);
  if (data.battingPosition) setCell(['battingposition', 'position'], data.battingPosition);
  if (data.bowlingProfile || data.bowlingStyle) setCell(['bowlingprofile', 'bowlingstyle'], data.bowlingProfile || data.bowlingStyle);
  if (data.wicketKeeper || data.isWicketKeeper) setCell(['areyouawicketkeeper', 'wicketkeeper', 'wk'], data.wicketKeeper || data.isWicketKeeper);
  if (data.photo || data.photoUrl) setCell(['photo', 'image', 'photourl'], data.photo || data.photoUrl);
  if (data.matches !== undefined) setCell(['matches'], data.matches);
  if (data.runs !== undefined) setCell(['runs'], data.runs);
  if (data.hundreds !== undefined || data["100's"] !== undefined) setCell(["100's", '100s', 'hundreds'], data.hundreds || data["100's"]);
  if (data.fifties !== undefined || data["50's"] !== undefined) setCell(["50's", '50s', 'fifties'], data.fifties || data["50's"]);
  if (data.thirties !== undefined || data["30's"] !== undefined) setCell(["30's", '30s', 'thirties'], data.thirties || data["30's"]);
  if (data.sr !== undefined || data.strikeRate !== undefined) setCell(['sr', 'strikerate'], data.sr || data.strikeRate);
  if (data.avg !== undefined || data.average !== undefined) setCell(['avg', 'average'], data.avg || data.average);
  if (data.wickets !== undefined) setCell(['wickets'], data.wickets);
  if (data.fiveWickets !== undefined || data['5 Wkts'] !== undefined) setCell(['5wkts', '5wickets'], data.fiveWickets || data['5 Wkts']);
  if (data.threeWickets !== undefined || data['3 Wkts'] !== undefined) setCell(['3wkts', '3wickets'], data.threeWickets || data['3 Wkts']);
  if (data.economy !== undefined) setCell(['economy', 'econ'], data.economy);

  return { success: true, message: 'Player updated successfully', player: data };
}

function deletePlayer(playerName, eventCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Attendee List') || ss.getSheetByName('AttendeeList') || ss.getSheetByName('Players') || ss.getSheets()[0];
  const allRows = sheet.getDataRange().getValues();
  if (allRows.length <= 1) return { error: 'No player data found' };

  const headers = allRows[0].map(h => String(h || '').trim());
  const colMap = {};
  headers.forEach((h, idx) => {
    colMap[h.toLowerCase().replace(/[\s_-]/g, '')] = idx;
  });

  const nameCol = colMap['name'] !== undefined ? colMap['name'] : (colMap['playername'] !== undefined ? colMap['playername'] : 1);
  const evCol = colMap['eventcode'] !== undefined ? colMap['eventcode'] : (colMap['event'] !== undefined ? colMap['event'] : -1);

  const targetName = (playerName || '').trim().toLowerCase();
  const targetEv = (eventCode || 'ESL2026').trim().toUpperCase();

  for (let i = 1; i < allRows.length; i++) {
    const rowName = String(allRows[i][nameCol] || '').trim().toLowerCase();
    const rowEv = evCol !== -1 ? (String(allRows[i][evCol] || '').trim().toUpperCase() || 'ESL2026') : 'ESL2026';
    if (rowName === targetName && (targetEv === 'ALL' || rowEv === targetEv || rowEv === 'ALL')) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Player deleted successfully' };
    }
  }

  return { error: 'Player "' + playerName + '" not found' };
}

// ===================== AUTH =====================

function authenticate(username, password, eventCode) {
  const teams = getTeams(eventCode).teams;
  const u = (username || '').trim();
  const p = (password || '').trim();

  for (const t of teams) {
    if (t.username === u && t.password === p) {
      return {
        success: true,
        team: {
          eventCode: t.eventCode,
          teamName: t.teamName,
          logoUrl: t.logoUrl,
          ownerName: t.ownerName,
          iconPlayer: t.iconPlayer,
          purseRemaining: t.purseRemaining,
          maxPlayers: t.maxPlayers
        }
      };
    }
  }
  return { success: false, error: 'Invalid credentials' };
}

// ===================== DASHBOARD =====================

function getDashboard(teamName, eventCode) {
  const settings = getSettings(eventCode).settings;
  const log = getAuctionLog(eventCode).log;
  const teams = getTeams(eventCode).teams;

  const myPlayers = log.filter(l => l.team === teamName && l.status === 'Sold');
  const allSold = log.filter(l => l.status === 'Sold');
  const allUnsold = log.filter(l => l.status === 'Unsold');
  const myTeam = teams.find(t => t.teamName === teamName) || {};

  return {
    currentPlayer: settings.current_player_name || '',
    currentBid: settings.current_bid || '0',
    currentBidder: settings.current_bidder || '',
    auctionStatus: settings.auction_status || 'stopped',
    myPlayers,
    allSold,
    allUnsold,
    purseRemaining: myTeam.purseRemaining || 0,
    totalTeams: teams.length,
    teams: teams.map(t => ({
      teamName: t.teamName,
      logoUrl: t.logoUrl,
      ownerName: t.ownerName,
      iconPlayer: t.iconPlayer,
      playerCount: allSold.filter(s => s.team === t.teamName).length,
      purseRemaining: t.purseRemaining
    }))
  };
}

// ===================== RESET =====================

function resetAuction(eventCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const filterCode = (eventCode || '').trim().toUpperCase();

  // Clear auction log for this event
  const logSheet = ss.getSheetByName(AUCTION_LOG_SHEET);
  if (logSheet) {
    const data = logSheet.getDataRange().getValues();
    if (data.length > 1) {
      const rawHeaders = data[0].map(h => String(h || '').trim());
      let evColIdx = -1;
      for (let c = 0; c < rawHeaders.length; c++) {
        const k = rawHeaders[c].toLowerCase().replace(/[\s_-]/g, '');
        if (k === 'eventcode' || k === 'event') {
          evColIdx = c;
          break;
        }
      }
      for (let i = data.length - 1; i >= 1; i--) {
        const rowCode = evColIdx !== -1 ? String(data[i][evColIdx] || '').trim().toUpperCase() : '';
        if (!filterCode || !rowCode || rowCode === filterCode) {
          logSheet.deleteRow(i + 1);
        }
      }
    }
  }

  // Reset settings
  updateSettings({
    current_player_index: '',
    current_player_name: '',
    current_bid: '0',
    current_bidder: '',
    auction_status: 'stopped'
  }, eventCode);

  // Reset team purses for this event (deducting retained player base values)
  const settings = getSettings(eventCode).settings;
  const budget = parseFloat(settings.budget_per_team) || 1000000;
  const minPlayerVal = parseFloat(settings.min_player_value) || 10000;

  // Build player base value lookup
  const playerSheet = ss.getSheetByName(PLAYERS_SHEET);
  const playerPrices = {};
  if (playerSheet) {
    const pRows = playerSheet.getDataRange().getValues();
    if (pRows.length > 1) {
      const pH = pRows[0].map(h => String(h || '').toLowerCase().replace(/[\s_-]/g, ''));
      const pNameIdx = pH.indexOf('name');
      let pPriceIdx = pH.indexOf('ticketprice');
      if (pPriceIdx === -1) pPriceIdx = pH.indexOf('baseprice');
      if (pPriceIdx === -1) pPriceIdx = pH.indexOf('price');
      for (let pi = 1; pi < pRows.length; pi++) {
        const pName = String(pRows[pi][pNameIdx] || '').trim().toLowerCase();
        const pVal = pPriceIdx !== -1 ? (parseFloat(pRows[pi][pPriceIdx]) || 0) : 0;
        if (pName) playerPrices[pName] = pVal > 0 ? pVal : minPlayerVal;
      }
    }
  }

  const teamSheet = ss.getSheetByName(TEAMS_SHEET);
  if (teamSheet) {
    const rows = teamSheet.getDataRange().getValues();
    if (rows.length > 1) {
      const rawHeaders = rows[0].map(h => String(h || '').trim());
      let evColIdx = -1;
      let purseColIdx = 6;
      let retainedColIdx = -1;
      for (let c = 0; c < rawHeaders.length; c++) {
        const k = rawHeaders[c].toLowerCase().replace(/[\s_-]/g, '');
        if (k === 'eventcode' || k === 'event') evColIdx = c;
        if (k === 'purseremaining' || k === 'purse' || k === 'budget') purseColIdx = c;
        if (k === 'retainedplayer' || k === 'retained' || k === 'retainedplayers') retainedColIdx = c;
      }

      for (let i = 1; i < rows.length; i++) {
        const rowCode = evColIdx !== -1 ? (String(rows[i][evColIdx] || '').trim().toUpperCase() || 'ESL2026') : 'ESL2026';
        if (!filterCode || rowCode === filterCode) {
          let teamBudget = budget;
          if (retainedColIdx !== -1) {
            const retRaw = String(rows[i][retainedColIdx] || '').trim();
            if (retRaw) {
              const rNames = retRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
              rNames.forEach(rn => {
                const pCost = playerPrices[rn] !== undefined ? playerPrices[rn] : minPlayerVal;
                teamBudget = Math.max(0, teamBudget - pCost);
              });
            }
          }
          teamSheet.getRange(i + 1, purseColIdx + 1).setValue(teamBudget);
        }
      }
    }
  }

  return { success: true };
}

// ===================== GOOGLE DRIVE FILE UPLOADS =====================

function uploadFile(data) {
  const baseFolderId = (data.baseFolderId || DRIVE_BASE_FOLDER_ID || '').trim();
  if (!baseFolderId) {
    return { error: 'No base Google Drive folder ID configured' };
  }

  let baseFolder;
  try {
    baseFolder = DriveApp.getFolderById(baseFolderId);
  } catch (err) {
    return { error: 'Could not access base Drive folder. Please verify permissions or folder ID: ' + err.message };
  }

  const type = (data.type || '').trim().toLowerCase(); // 'banner' or 'teamlogo'
  const eventCode = (data.eventCode || 'ESL2026').trim().toUpperCase();
  const teamName = (data.teamName || '').trim();
  const rawBase64 = data.base64Data || '';
  const mimeType = (data.mimeType || 'image/png').toLowerCase();

  if (!rawBase64) {
    return { error: 'No image content provided for upload' };
  }

  // Strip data:image/...;base64, prefix if present
  let cleanBase64 = rawBase64;
  if (cleanBase64.indexOf(',') !== -1) {
    cleanBase64 = cleanBase64.split(',')[1];
  }

  const bytes = Utilities.base64Decode(cleanBase64);

  // 1. Get or create EventCode subfolder inside Base Folder
  const eventFolder = getOrCreateSubFolder(baseFolder, eventCode);

  let targetFolder = eventFolder;
  let targetFileName = '';

  if (type === 'banner' || type === 'eventbanner') {
    // Banner should be uploaded under folder named as EventCode. File name should be banner.jpg | png
    const ext = (mimeType.includes('jpeg') || mimeType.includes('jpg')) ? 'jpg' : (mimeType.includes('webp') ? 'webp' : 'png');
    targetFileName = 'banner.' + ext;

    // Trash previous banner files in this event folder
    trashFilesByNamePattern(eventFolder, /^banner\.(png|jpe?g|webp)$/i);
    targetFolder = eventFolder;
  } else if (type === 'teamlogo' || type === 'logo') {
    // Team logo should be uploaded under folder named as EventCode/Teams and File name should be <teamname>.jpg | png
    if (!teamName) {
      return { error: 'Team name is required for team logo upload' };
    }
    const teamsFolder = getOrCreateSubFolder(eventFolder, 'Teams');
    const ext = (mimeType.includes('jpeg') || mimeType.includes('jpg')) ? 'jpg' : (mimeType.includes('webp') ? 'webp' : 'png');
    const safeName = teamName.replace(/[/\\?%*:|"<>]/g, '_').trim();
    targetFileName = safeName + '.' + ext;

    // Trash previous logos for this team
    trashFilesByName(teamsFolder, safeName + '.png');
    trashFilesByName(teamsFolder, safeName + '.jpg');
    trashFilesByName(teamsFolder, safeName + '.jpeg');
    trashFilesByName(teamsFolder, safeName + '.webp');
    targetFolder = teamsFolder;
  } else if (type === 'playerphoto' || type === 'player' || type === 'photo') {
    // Player photo should be uploaded under folder named as EventCode/players and File name should be <playerName>.jpg | png
    const playerName = (data.playerName || '').trim();
    if (!playerName) {
      return { error: 'Player name is required for player photo upload' };
    }
    const playersFolder = getOrCreateSubFolder(eventFolder, 'players');
    const ext = (mimeType.includes('jpeg') || mimeType.includes('jpg')) ? 'jpg' : (mimeType.includes('webp') ? 'webp' : 'png');
    const safeName = playerName.replace(/[/\\?%*:|"<>]/g, '_').trim();
    targetFileName = safeName + '.' + ext;

    // Trash previous photos for this player
    trashFilesByName(playersFolder, safeName + '.png');
    trashFilesByName(playersFolder, safeName + '.jpg');
    trashFilesByName(playersFolder, safeName + '.jpeg');
    trashFilesByName(playersFolder, safeName + '.webp');
    targetFolder = playersFolder;
  } else {
    return { error: 'Unknown upload type: ' + type + '. Must be "banner", "teamLogo", or "playerPhoto"' };
  }

  const blob = Utilities.newBlob(bytes, mimeType, targetFileName);
  const file = targetFolder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    console.warn('Set sharing warning:', e);
  }

  const fileId = file.getId();
  const driveViewUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
  const publicUrl = driveViewUrl;
  const folderPath = type.includes('banner') ? eventCode : (type.includes('player') || type.includes('photo') ? (eventCode + '/players') : (eventCode + '/Teams'));

  // Automatically update Sheet row if event, team, or player already exists
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (type.includes('banner')) {
      const eSheet = ss.getSheetByName(EVENTS_SHEET);
      if (eSheet) {
        const eData = eSheet.getDataRange().getValues();
        for (let i = 1; i < eData.length; i++) {
          if (String(eData[i][1] || '').trim().toUpperCase() === eventCode) {
            eSheet.getRange(i + 1, 8).setValue(publicUrl);
            break;
          }
        }
      }
    } else if (type.includes('logo')) {
      const tSheet = ss.getSheetByName(TEAMS_SHEET);
      if (tSheet) {
        const tRows = tSheet.getDataRange().getValues();
        const rawHeaders = tRows[0].map(h => String(h || '').trim());
        const colMap = {};
        for (let c = 0; c < rawHeaders.length; c++) {
          const k = rawHeaders[c].toLowerCase().replace(/[\s_-]/g, '');
          if (k) colMap[k] = c;
        }
        const teamColIdx = colMap['teamname'] !== undefined ? colMap['teamname'] : (colMap['team'] !== undefined ? colMap['team'] : 0);
        const evColIdx = colMap['eventcode'] !== undefined ? colMap['eventcode'] : (colMap['event'] !== undefined ? colMap['event'] : -1);
        const logoColIdx = colMap['logourl'] !== undefined ? colMap['logourl'] : (colMap['logo'] !== undefined ? colMap['logo'] : 1);

        for (let i = 1; i < tRows.length; i++) {
          const tName = String(tRows[i][teamColIdx] || '').trim().toLowerCase();
          const rowCode = evColIdx !== -1 ? (String(tRows[i][evColIdx] || '').trim().toUpperCase() || 'ESL2026') : 'ESL2026';
          if (tName === teamName.toLowerCase() && rowCode === eventCode) {
            tSheet.getRange(i + 1, logoColIdx + 1).setValue(publicUrl);
            break;
          }
        }
      }
    } else if (type.includes('player') || type.includes('photo')) {
      const pSheet = ss.getSheetByName('Attendee List') || ss.getSheetByName('AttendeeList') || ss.getSheetByName('Players') || ss.getSheets()[0];
      if (pSheet) {
        const pRows = pSheet.getDataRange().getValues();
        const rawHeaders = pRows[0].map(h => String(h || '').trim());
        let nameColIdx = -1;
        let evColIdx = -1;
        let photoColIdx = -1;
        for (let c = 0; c < rawHeaders.length; c++) {
          const k = rawHeaders[c].toLowerCase().replace(/[\s_-]/g, '');
          if (k === 'name' || k === 'playername' || k === 'player') nameColIdx = c;
          if (k === 'eventcode' || k === 'event') evColIdx = c;
          if (k === 'photo' || k === 'image' || k === 'photourl') photoColIdx = c;
        }
        if (photoColIdx === -1) {
          photoColIdx = rawHeaders.length;
          pSheet.getRange(1, photoColIdx + 1).setValue('Photo');
        }
        if (nameColIdx !== -1) {
          const targetPlayerName = (data.playerName || '').trim().toLowerCase();
          for (let i = 1; i < pRows.length; i++) {
            const pName = String(pRows[i][nameColIdx] || '').trim().toLowerCase();
            const rowCode = evColIdx !== -1 ? (String(pRows[i][evColIdx] || '').trim().toUpperCase() || 'ESL2026') : 'ESL2026';
            if (pName === targetPlayerName && (rowCode === eventCode || eventCode === 'ALL')) {
              pSheet.getRange(i + 1, photoColIdx + 1).setValue(publicUrl);
              break;
            }
          }
        }
      }
    }
  } catch (sheetErr) {
    console.warn('Auto-sheet update warning:', sheetErr);
  }

  return {
    success: true,
    fileId: fileId,
    fileName: targetFileName,
    folderPath: folderPath,
    url: publicUrl,
    viewUrl: driveViewUrl
  };
}

function getOrCreateSubFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  while (folders.hasNext()) {
    const f = folders.next();
    if (!f.isTrashed()) return f;
  }
  return parentFolder.createFolder(folderName);
}

function trashFilesByName(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  while (files.hasNext()) {
    const f = files.next();
    f.setTrashed(true);
  }
}

function trashFilesByNamePattern(folder, regex) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (regex.test(f.getName())) {
      f.setTrashed(true);
    }
  }
}
