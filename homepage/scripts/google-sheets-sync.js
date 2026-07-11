/**
 * Google Apps Script – GoPlantATree → Google Sheet
 *
 * Synchronisiert Bestellungen und Angebote (Offerings) in separate Sheets.
 *
 * Anleitung:
 * 1. Google Sheet öffnen
 * 2. Erweiterungen → Apps Script
 * 3. Diesen Code einfügen (Code.gs ersetzen)
 * 4. syncOrders() / syncOfferings() manuell ausführen zum Testen (▶ Button)
 * 5. Optional: Trigger einrichten für automatische Synchronisation:
 *    → Links auf "Auslöser" (Uhr-Symbol) → "+ Auslöser hinzufügen"
 *    → Funktion: syncAll, zeitgesteuert, z.B. stündlich
 */

// ─── Konfiguration ──────────────────────────────────────────

var CONFIG = {
  BASE_URL: 'https://goplantatree.org/api/v1',
  API_KEY: 'DEIN-API-KEY-HIER',
  PROJECT: 'klimabaumaktion-ulm',
};

// ─── Spaltendefinitionen ────────────────────────────────────

var ORDER_COLUMNS = [
  { header: 'Bestellnr.',    path: 'orderNumber' },
  { header: 'Status',        path: 'status' },
  { header: 'Bestellt am',   path: 'orderedAt',    format: 'date' },
  { header: 'Name',          path: 'name' },
  { header: 'E-Mail',        path: 'email' },
  { header: 'Telefon',       path: 'phone' },
  { header: 'Straße',        path: 'street' },
  { header: 'PLZ',           path: 'zip' },
  { header: 'Stadt',         path: 'city' },
  { header: 'Sonderadresse', path: 'specialAddress', format: 'boolean' },
  { header: 'Baum (Slug)',   path: 'offering.slug' },
  { header: 'Baum',          path: 'offering.name' },
  { header: 'Kategorie',     path: 'offering.category' },
  { header: 'Botanisch',     path: 'offering.bezeichnungBotanisch' },
  { header: 'Preis (netto)', path: 'offering.priceNet' },
  { header: 'Zeitfenster',   path: 'timeSlot' },
  { header: 'Pflanzort',     path: 'gardenType' },
];

var OFFERING_COLUMNS = [
  { header: 'Name',              path: 'name' },
  { header: 'Slug',              path: 'slug' },
  { header: 'Kategorie',         path: 'category' },
  { header: 'Botanisch',         path: 'bezeichnungBotanisch' },
  { header: 'Pflanzgröße Höhe',  path: 'pflanzgroesseHoehe' },
  { header: 'Pflanzgröße StU',   path: 'pflanzgroesseStammumfang' },
  { header: 'Endgröße Höhe',     path: 'endgroesseHoehe' },
  { header: 'Endgröße Breite',   path: 'endgroesseBreite' },
  { header: 'Preis (netto)',     path: 'priceNet' },
  { header: 'Bestand',           path: 'stock' },
  { header: 'Verfügbar',         path: 'available',  format: 'boolean' },
  { header: 'Bemerkung',         path: 'bemerkung' },
  { header: 'Sortierung',        path: 'sortOrder' },
];

// ─── Menü ───────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌳 GoPlantATree')
    .addItem('Bestellungen synchronisieren', 'syncOrders')
    .addItem('Angebote synchronisieren', 'syncOfferings')
    .addSeparator()
    .addItem('Alles synchronisieren', 'syncAll')
    .addToUi();
}

// ─── Einstiegspunkte ────────────────────────────────────────

function syncAll() {
  syncOrders();
  syncOfferings();
}

function syncOrders() {
  var url = CONFIG.BASE_URL + '/orders';
  var params = { project: CONFIG.PROJECT };
  var items = fetchAll(url, params, true);
  syncToSheet('Bestellungen', ORDER_COLUMNS, items);
}

function syncOfferings() {
  var url = CONFIG.BASE_URL + '/offerings';
  var params = { project: CONFIG.PROJECT };
  var items = fetchAll(url, params, false);
  items.sort(function(a, b) { return (a.slug || '').localeCompare(b.slug || ''); });
  syncToSheet('Angebote', OFFERING_COLUMNS, items);
}

// ─── Generische Sheet-Synchronisation ───────────────────────

function syncToSheet(sheetName, columns, items) {
  if (!items || items.length === 0) {
    Logger.log(sheetName + ': Keine Daten gefunden.');
    return;
  }

  var sheet = getOrCreateSheet(sheetName);
  var headers = columns.map(function(c) { return c.header; });

  // Header-Zeile schreiben (fett)
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Datenzeilen aufbereiten
  var rows = items.map(function(item) {
    return columns.map(function(col) {
      var value = getNestedValue(item, col.path);
      if (col.format === 'date' && value) return new Date(value);
      if (col.format === 'boolean') return value ? 'Ja' : 'Nein';
      return value != null ? value : '';
    });
  });

  // Alte Daten löschen (ab Zeile 2) und neue schreiben
  var lastRow = Math.max(sheet.getLastRow(), 1);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // Spaltenbreiten automatisch anpassen
  for (var i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  Logger.log(sheetName + ': ' + rows.length + ' Einträge synchronisiert.');
}

// ─── API-Abruf (mit optionaler Paginierung) ─────────────────

function fetchAll(baseUrl, params, paginated) {
  var allItems = [];
  var skip = 0;
  var limit = 100;

  while (true) {
    var url = baseUrl + '?';
    for (var key in params) {
      if (params[key]) url += key + '=' + encodeURIComponent(params[key]) + '&';
    }
    if (paginated) {
      url += 'limit=' + limit + '&skip=' + skip;
    }

    Logger.log('Lade: ' + url);

    var response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: { 'x-api-key': CONFIG.API_KEY },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('API-Fehler: ' + response.getResponseCode() + ' – ' + response.getContentText());
      break;
    }

    var data = JSON.parse(response.getContentText());

    if (paginated) {
      // Paginiertes Format: { items: [...], total: N }
      var items = data.items || [];
      var total = data.total || 0;

      if (items.length === 0) break;

      for (var i = 0; i < items.length; i++) {
        allItems.push(items[i]);
      }

      Logger.log('Geladen: ' + allItems.length + ' / ' + total);
      if (allItems.length >= total) break;

      skip += limit;
    } else {
      // Nicht-paginiert: API gibt direkt ein Array zurück
      if (Array.isArray(data)) {
        for (var j = 0; j < data.length; j++) {
          allItems.push(data[j]);
        }
      }
      break;
    }
  }

  return allItems;
}

// ─── Hilfsfunktionen ────────────────────────────────────────

function getNestedValue(obj, path) {
  var parts = path.split('.');
  var current = obj;
  for (var i = 0; i < parts.length; i++) {
    if (current == null) return null;
    current = current[parts[i]];
  }
  return current !== undefined ? current : null;
}

function getOrCreateSheet(name) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  return sheet;
}
