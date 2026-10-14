
/******************************************************
 * SHOPIFY CONFIGURATION
 * Reads credentials from Script Properties
 ******************************************************/
 function testScriptRuntime() {
  Logger.log("Apps Script runtime is working.");
}
function getShopifyConfig() {
  const props = PropertiesService.getScriptProperties();

  const store = props.getProperty("SHOPIFY_STORE");
  const accessToken = props.getProperty("SHOPIFY_ACCESS_TOKEN");
  const apiVersion = props.getProperty("SHOPIFY_API_VERSION");

  if (!store || !accessToken || !apiVersion) {
    throw new Error(
      "Missing Shopify configuration. Check Script Properties."
    );
  }

  if (
    !/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(store)
  ) {
    throw new Error("Invalid Shopify store domain.");
  }

  return {
    store: store,
    accessToken: accessToken,
    apiVersion: apiVersion
  };
}


/******************************************************
 * SHOPIFY INVENTORY SYNC
 * Trigger: Installable "On Edit"
 * Sheet:
 * Inventory
 *
 * Columns:
 * A = SKU
 * B = Location
 * C = Available
 ******************************************************/


/******************************************************
 * MAIN FUNCTION: VALIDATE AND UPDATE INVENTORY
 * Handles single-cell and multi-row edits in column C
 ******************************************************/
function updateInventory(e) {
  if (!e || !e.range) return;

  const editedRange = e.range;
  const sheet = editedRange.getSheet();

  if (sheet.getName() !== "Inventory") return;

  // Continue only if the edited range includes column C.
  if (
    editedRange.getColumn() > 3 ||
    editedRange.getLastColumn() < 3
  ) {
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let logSheet = ss.getSheetByName("Sync_Log");

  if (!logSheet) {
    createLogSheet();
    logSheet = ss.getSheetByName("Sync_Log");
  }

  const firstRow = Math.max(2, editedRange.getRow());
  const lastRow = editedRange.getLastRow();

  if (firstRow > lastRow) return;

  // Load the maps once for the entire edit.
  let skuMap;
  let locationMap;

  try {
    skuMap = getSkuMap();
    locationMap = getLocationMap();
  } catch (err) {
    logSync(
      logSheet,
      "",
      "",
      "",
      "ERROR",
      "Failed to load Shopify data: " + err.message
    );
    return;
  }

  // Process every affected row.
  for (let row = firstRow; row <= lastRow; row++) {
    const sku = String(
      sheet.getRange(row, 1).getDisplayValue()
    ).trim();

    const locationName = String(
      sheet.getRange(row, 2).getDisplayValue()
    ).trim();

    const qtyCell = sheet.getRange(row, 3).getValue();

    // Preserve existing behavior: blank quantity means no update.
    if (qtyCell === "" || qtyCell === null) continue;

    const qty = Number(qtyCell);

    // Validate required fields.
    if (!sku) {
      logSync(
        logSheet, sku, locationName, qtyCell,
        "FAILED", "SKU IS REQUIRED"
      );
      continue;
    }

    if (!locationName) {
      logSync(
        logSheet, sku, locationName, qtyCell,
        "FAILED", "LOCATION IS REQUIRED"
      );
      continue;
    }

    // Inventory quantities must be non-negative integers.
    if (
      typeof qtyCell === "boolean" ||
      (typeof qtyCell === "string" && qtyCell.trim() === "") ||
      !Number.isFinite(qty) ||
      !Number.isInteger(qty) ||
      qty < 0
    ) {
      logSync(
        logSheet, sku, locationName, qtyCell,
        "FAILED", "INVALID QUANTITY: USE A NON-NEGATIVE INTEGER"
      );
      continue;
    }

    // Find the Shopify inventory item.
    let inventoryItemId = skuMap[sku];

    if (!inventoryItemId) {
      // Refresh cache once in case the product was added recently.
      try {
        PropertiesService
          .getScriptProperties()
          .deleteProperty("SKU_MAP");

        skuMap = getSkuMap();
        inventoryItemId = skuMap[sku];
      } catch (err) {
        logSync(
          logSheet, sku, locationName, qty,
          "ERROR", "SKU lookup failed: " + err.message
        );
        continue;
      }
    }

    if (!inventoryItemId) {
      logSync(
        logSheet, sku, locationName, qty,
        "FAILED", "SKU NOT FOUND"
      );
      continue;
    }

    const locationId = locationMap[locationName];

    if (!locationId) {
      logSync(
        logSheet, sku, locationName, qty,
        "FAILED", "LOCATION NOT FOUND"
      );
      continue;
    }

    // Update Shopify and record the outcome.
    try {
      setInventoryLevel(
        inventoryItemId,
        locationId,
        qty
      );

      logSync(
        logSheet, sku, locationName, qty,
        "SUCCESS", "Updated"
      );

    } catch (err) {
      logSync(
        logSheet, sku, locationName, qty,
        "ERROR", err.message
      );
    }
  }
}

/******************************************************
 * LOCATION MAP
 ******************************************************/

function getLocationMap() {
  const config = getShopifyConfig();

  const url =
    `https://${config.store}/admin/api/${config.apiVersion}/locations.json`;

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "X-Shopify-Access-Token": config.accessToken
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();

  if (code !== 200) {
    throw new Error("Location lookup failed (" + code + "): " + text);
  }

  const json = JSON.parse(text);
  const map = {};

  json.locations.forEach(function(location) {
    map[String(location.name).trim()] = location.id;
  });

  return map;
}


/******************************************************
 * SKU CACHE
 ******************************************************/
function getSkuMap(){
const config = getShopifyConfig();
  const props =
    PropertiesService.getScriptProperties();

  const cache =
    props.getProperty("SKU_MAP");

  if(cache){

      return JSON.parse(cache);

  }

  const map={};

  let url =
  `https://${config.store}/admin/api/${config.apiVersion}/products.json?limit=250`;

  const options={

      method:"get",

      headers: {
  "X-Shopify-Access-Token": config.accessToken
}

  };

  while(url){

      const response =
          UrlFetchApp.fetch(url,options);

      const json =
          JSON.parse(response.getContentText());

      json.products.forEach(function(product){

          product.variants.forEach(function(variant){

              if(variant.sku){

                  map[
                    String(variant.sku).trim()
                  ] = variant.inventory_item_id;

              }

          });

      });

      const link =
          response.getHeaders()["Link"];

      url =
          getNextPageUrl(link);

  }

  props.setProperty(
      "SKU_MAP",
      JSON.stringify(map)
  );

  return map;

}


/******************************************************
 * UPDATE INVENTORY IN SHOPIFY
 ******************************************************/

function setInventoryLevel(inventoryItemId, locationId, quantity) {
  const config = getShopifyConfig();

  const url =
    `https://${config.store}/admin/api/${config.apiVersion}/inventory_levels/set.json`;

  const payload = {
    location_id: Number(locationId),
    inventory_item_id: Number(inventoryItemId),
    available: Number(quantity)
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      "X-Shopify-Access-Token": config.accessToken
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const responseText = response.getContentText();

  if (code !== 200) {
    throw new Error(
      "Inventory update failed (" + code + "): " + responseText
    );
  }

  return JSON.parse(responseText);
}


/******************************************************
 * HANDLE PAGINATION
 ******************************************************/
function getNextPageUrl(linkHeader) {

  if (!linkHeader) return null;

  const match =
    linkHeader.match(/<([^>]+)>;\s*rel="next"/);

  return match ? match[1] : null;
}

/******************************************************
 * LOG RESULTS
 ******************************************************/
function logSync(sheet, sku, location, qty, status, message) {

  sheet.appendRow([
    new Date(),
    sku,
    location,
    qty,
    status,
    message
  ]);

}

/******************************************************
 * FIND SKU (FOR TESTING)
 ******************************************************/
function findSku() {

  const sku = "LF-SL-DC-OF-NV-11";

  const skuMap = getSkuMap();

  if (skuMap[sku]) {

    Logger.log("FOUND");
    Logger.log(skuMap[sku]);

  } else {

    Logger.log("NOT FOUND");

  }

}

/******************************************************
 * CLEAR SKU CACHE
 ******************************************************/
function clearSkuCache() {

  PropertiesService
    .getScriptProperties()
    .deleteProperty("SKU_MAP");

  Logger.log("SKU cache cleared");

}

/******************************************************
 * REBUILD SKU CACHE
 ******************************************************/
function rebuildSkuCache() {

  clearSkuCache();

  getSkuMap();

  Logger.log("SKU cache rebuilt");

}

/******************************************************
 * CREATE LOG SHEET IF MISSING
 ******************************************************/
function createLogSheet() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName("Sync_Log");

  if (!sheet) {

    sheet = ss.insertSheet("Sync_Log");

    sheet.appendRow([
      "Timestamp",
      "SKU",
      "Location",
      "Qty",
      "Status",
      "Message"
    ]);

  }

}

/******************************************************
 * TEST SHOPIFY CONNECTION
 ******************************************************/

function testConnection() {
  const config = getShopifyConfig();

  const url =
    `https://${config.store}/admin/api/${config.apiVersion}/shop.json`;

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "X-Shopify-Access-Token": config.accessToken
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();

  if (code !== 200) {
    throw new Error(
      "Shopify connection failed (" + code + "): " +
      response.getContentText()
    );
  }

  const data = JSON.parse(response.getContentText());

  Logger.log("Shopify connection successful.");
  Logger.log("Store name: " + data.shop.name);
}

