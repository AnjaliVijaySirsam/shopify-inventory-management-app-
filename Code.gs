const SHOPIFY_STORE = "YOUR_STORE.myshopify.com";

const ACCESS_TOKEN = "YOUR_SHOPIFY_ACCESS_TOKEN";

const API_VERSION = "YOUR_API_VERSION";

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

 * MAIN FUNCTION

 ******************************************************/

function updateInventory(e) {

  if (!e) return;

  const sheet = e.range.getSheet();

  if (sheet.getName() !== "Inventory") return;

  // Only Available column (Column C)

  if (e.range.getColumn() != 3) return;

  const row = e.range.getRow();

  if (row == 1) return;

  const sku = String(sheet.getRange(row,1).getValue()).trim();

  const locationName = String(sheet.getRange(row,2).getValue()).trim();

  const qtyCell = sheet.getRange(row,3).getValue();

  // Ignore blank inventory

  if(qtyCell === "" || qtyCell === null){

    return;

  }

  const qty = Number(qtyCell);

  const logSheet =

    SpreadsheetApp.getActiveSpreadsheet()

      .getSheetByName("Sync_Log");

  let skuMap = getSkuMap();

  let inventoryItemId = skuMap[sku];

  // Refresh cache if SKU not found

  if(!inventoryItemId){

    PropertiesService

      .getScriptProperties()

      .deleteProperty("SKU_MAP");

    skuMap = getSkuMap();

    inventoryItemId = skuMap[sku];

  }

  if(!inventoryItemId){

    logSync(

      logSheet,

      sku,

      locationName,

      qty,

      "FAILED",

      "SKU NOT FOUND"

    );

    return;

  }

  const locationMap = getLocationMap();

  const locationId = locationMap[locationName];

  if(!locationId){

    logSync(

      logSheet,

      sku,

      locationName,

      qty,

      "FAILED",

      "LOCATION NOT FOUND"

    );

    return;

  }

  try{

    setInventoryLevel(

      inventoryItemId,

      locationId,

      qty

    );

    logSync(

      logSheet,

      sku,

      locationName,

      qty,

      "SUCCESS",

      "Updated"

    );

  }catch(err){

    logSync(

      logSheet,

      sku,

      locationName,

      qty,

      "ERROR",

      err.message

    );

  }

}

/******************************************************

 * LOCATION MAP

 ******************************************************/

function getLocationMap(){

  const url =

`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/locations.json`;

  const response =

    UrlFetchApp.fetch(url,{

      method:"get",

      headers:{

        "X-Shopify-Access-Token":ACCESS_TOKEN

      }

    });

  const json =

    JSON.parse(response.getContentText());

  const map={};

  json.locations.forEach(function(location){

      map[

        String(location.name).trim()

      ] = location.id;

  });

  return map;

}

/******************************************************

 * SKU CACHE

 ******************************************************/

function getSkuMap(){

  const props =

    PropertiesService.getScriptProperties();

  const cache =

    props.getProperty("SKU_MAP");

  if(cache){

      return JSON.parse(cache);

  }

  const map={};

  let url =

`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products.json?limit=250`;

  const options={

      method:"get",

      headers:{

          "X-Shopify-Access-Token":ACCESS_TOKEN

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

  const url =

    `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/inventory_levels/set.json`;

  const payload = {

    location_id: Number(locationId),

    inventory_item_id: Number(inventoryItemId),

    available: Number(quantity)

  };

  const response = UrlFetchApp.fetch(url, {

    method: "post",

    contentType: "application/json",

    headers: {

      "X-Shopify-Access-Token": ACCESS_TOKEN

    },

    payload: JSON.stringify(payload),

    muteHttpExceptions: true

  });

  const code = response.getResponseCode();

  const text = response.getContentText();

  if (code !== 200) {

    throw new Error(text);

  }

  return JSON.parse(text);

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

  const sku = "YOUR_TEST_SKU";

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

  const url =

    `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/shop.json`;

  const response = UrlFetchApp.fetch(url, {

    method: "get",

    headers: {

      "X-Shopify-Access-Token": ACCESS_TOKEN

    }

  });

  Logger.log(response.getContentText());

}