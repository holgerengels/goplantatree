/**
 * Google Apps Script – GoPlantATree Orders → Google Sheet Sync
 *
 * Anleitung:
 * 1. Google Sheet öffnen
 * 2. Erweiterungen → Apps Script
 * 3. Diesen Code einfügen
 * 4. API_URL und API_KEY anpassen
 * 5. syncOrders() manuell ausführen zum Testen
 * 6. Trigger einrichten: Bearbeiten → Auslöser → Neuer Auslöser
 *    → syncOrders, zeitgesteuert, z.B. stündlich
 */

// ─── Konfiguration ──────────────────────────────────────────
const CONFIG = {
  API_URL: 'https://goplantatree.org/api/v1/orders',
  API_KEY: 'DEIN-API-KEY-HIER',
  PROJECT: 'klimabaumaktion-ulm',  // Projekt-Slug (oder leer lassen für alle)
  SHEET_NAME: 'Bestellungen',       // Name des Tabellenblatts
};

// Spalten, die ins Sheet geschrieben werden (Reihenfolge = Spaltenreihenfolge)
const COLUMNS = [
  { header: 'Bestellnr.',       path: 'orderNumber' },
  { header: 'Status',           path: 'status' },
  { header: 'Bestellt am',      path: 'orderedAt',    format: 'date' },
  { header: 'Name',             path: 'name' },
  { header: 'E-Mail',           path: 'email' },
  { header: 'Telefon',          path: 'phone' },
  { header: 'Straße',           path: 'street' },
  { header: 'PLZ',              path: 'zip' },
  { header: 'Stadt',            path: 'city' },
  { header: 'Sonderadresse',    path: 'specialAddress', format: 'boolean' },
  { header: 'Baum',             path: 'offering.name' },
  { header: 'Kategorie',        path: 'offering.category' },
  { header: 'Botanisch',        path: 'offering.bezeichnungBotanisch' },
  { header: 'Preis (netto)',    path: 'offering.priceNet' },
  { header: 'Zeitfenster',      path: 'timeSlot' },
  { header: 'Pflanzort',        path: 'gardenType' },
];

// ─── Hauptfunktion ──────────────────────────────────────────

function syncOrders() {
  const orders = fetchAllOrders();
  if (!orders || orders.length === 0) {
    Logger.log('Keine Bestellungen gefunden.');
    return;
  }

  const sheet = getOrCreateSheet(CONFIG.SHEET_NAME);

  // Header schreiben
  const headers = COLUMNS.map(c => c.header);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  // Daten aufbereiten
  const rows = orders.map(order => {
    return COLUMNS.map(col => {
      const value = getNestedValue(order, col.path);
      if (col.format === 'date' && value) {
        return new Date(value);
      }
      if (col.format === 'boolean') {
        return value ? 'Ja' : 'Nein';
      }
      return value || '';
    });
  });

  // Alte Daten löschen (ab Zeile 2) und neue schreiben
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
  }
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  Logger.log(`${rows.length} Bestellungen synchronisiert.`);
}

// ─── API-Abruf ──────────────────────────────────────────────

function fetchAllOrders() {
  const allOrders = [];
  let page = 1;
  const limit = 100;

  while (true) {
    let url = `${CONFIG.API_URL}?limit=${limit}&page=${page}`;
    if (CONFIG.PROJECT) {
      url += `&project=${encodeURIComponent(CONFIG.PROJECT)}`;
    }

    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': CONFIG.API_KEY,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log(`API-Fehler: ${response.getResponseCode()} – ${response.getContentText()}`);
      return allOrders;
    }

    const data = JSON.parse(response.getContentText());
    const items = data.items || data;

    if (!Array.isArray(items) || items.length === 0) break;

    allOrders.push(...items);

    // Prüfen ob es weitere Seiten gibt
    if (data.totalPages && page >= data.totalPages) break;
    if (items.length < limit) break;

    page++;
  }

  return allOrders;
}

// ─── Hilfsfunktionen ────────────────────────────────────────

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

function getOrCreateSheet(name) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  return sheet;
}
