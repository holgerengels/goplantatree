/**
 * Google Apps Script – GoPlantATree Bestellungen → Google Sheet
 *
 * Anleitung:
 * 1. Google Sheet öffnen
 * 2. Erweiterungen → Apps Script
 * 3. Diesen Code einfügen (Code.gs ersetzen)
 * 4. syncOrders() manuell ausführen zum Testen (▶ Button)
 * 5. Optional: Trigger einrichten für automatische Synchronisation:
 *    → Links auf "Auslöser" (Uhr-Symbol) → "+ Auslöser hinzufügen"
 *    → Funktion: syncOrders, zeitgesteuert, z.B. stündlich
 */

// ─── Konfiguration ──────────────────────────────────────────
var CONFIG = {
  API_URL: 'https://goplantatree.org/api/v1/orders',
  API_KEY: 'DEIN-API-KEY-HIER',
  PROJECT: 'klimabaumaktion-ulm',
  SHEET_NAME: 'Bestellungen',
};

// Spalten – Reihenfolge hier = Spaltenreihenfolge im Sheet
var COLUMNS = [
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
  { header: 'Baum',          path: 'offering.name' },
  { header: 'Kategorie',     path: 'offering.category' },
  { header: 'Botanisch',     path: 'offering.bezeichnungBotanisch' },
  { header: 'Preis (netto)', path: 'offering.priceNet' },
  { header: 'Zeitfenster',   path: 'timeSlot' },
  { header: 'Pflanzort',     path: 'gardenType' },
];

// ─── Hauptfunktion ──────────────────────────────────────────

function syncOrders() {
  var orders = fetchAllOrders();
  if (!orders || orders.length === 0) {
    Logger.log('Keine Bestellungen gefunden.');
    return;
  }

  var sheet = getOrCreateSheet(CONFIG.SHEET_NAME);
  var headers = COLUMNS.map(function(c) { return c.header; });

  // Header-Zeile schreiben (fett)
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Datenzeilen aufbereiten
  var rows = orders.map(function(order) {
    return COLUMNS.map(function(col) {
      var value = getNestedValue(order, col.path);
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

  Logger.log(rows.length + ' Bestellungen synchronisiert.');
}

// ─── API-Abruf (mit skip/limit Paginierung) ─────────────────

function fetchAllOrders() {
  var allOrders = [];
  var skip = 0;
  var limit = 100;

  while (true) {
    var url = CONFIG.API_URL + '?limit=' + limit + '&skip=' + skip;
    if (CONFIG.PROJECT) {
      url += '&project=' + encodeURIComponent(CONFIG.PROJECT);
    }

    Logger.log('Lade: ' + url);

    var response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': CONFIG.API_KEY
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('API-Fehler: ' + response.getResponseCode() + ' – ' + response.getContentText());
      break;
    }

    var data = JSON.parse(response.getContentText());

    // API gibt { items: [...], total: N } zurück
    var items = data.items || [];
    var total = data.total || 0;

    if (items.length === 0) break;

    for (var i = 0; i < items.length; i++) {
      allOrders.push(items[i]);
    }

    Logger.log('Geladen: ' + allOrders.length + ' / ' + total);

    // Alle geladen?
    if (allOrders.length >= total) break;

    skip += limit;
  }

  return allOrders;
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
