# Shopify Inventory Management App

A Google Apps Script based inventory management and synchronization system that connects Google Sheets with the Shopify Admin API.

The application allows inventory quantities maintained in Google Sheets to be synchronized with Shopify automatically when inventory values are edited.

## Overview

This project was built to simplify inventory management by using Google Sheets as an inventory interface and Shopify as the eCommerce inventory platform.

When the available inventory quantity is updated in the Google Sheets `Inventory` sheet, the Apps Script identifies the corresponding Shopify inventory item and location, then updates the inventory level through the Shopify Admin API.

## Features

* Sync inventory quantities from Google Sheets to Shopify
* SKU-based inventory identification
* Shopify location mapping
* Automatic inventory updates
* SKU mapping with Script Properties caching
* Automatic cache refresh when a SKU is not found
* Shopify API pagination handling
* Inventory synchronization logging
* Failed synchronization tracking
* Shopify connection testing
* SKU cache rebuilding
* Google Apps Script installable edit trigger support

## Technology Stack

* Google Apps Script
* Google Sheets
* Shopify Admin API
* JavaScript
* Shopify REST API
* Google Apps Script Properties Service

## Architecture

```text
Google Sheets
     |
     | Inventory quantity edited
     v
Google Apps Script
     |
     | SKU lookup
     v
Shopify Product / Variant
     |
     | Inventory Item ID
     v
Shopify Location
     |
     | Inventory update
     v
Shopify Inventory API
     |
     v
Sync_Log
```

## Google Sheets Structure

### Inventory Sheet

The `Inventory` sheet uses the following columns:

| Column | Field     |
| ------ | --------- |
| A      | SKU       |
| B      | Location  |
| C      | Available |

Example:

| SKU             | Location       | Available |
| --------------- | -------------- | --------: |
| PRODUCT-SKU-001 | Main Warehouse |        25 |
| PRODUCT-SKU-002 | Main Warehouse |        10 |

### Sync_Log Sheet

The application records synchronization results in the `Sync_Log` sheet.

| Field     | Description                  |
| --------- | ---------------------------- |
| Timestamp | Time of synchronization      |
| SKU       | Product SKU                  |
| Location  | Shopify location             |
| Qty       | Requested inventory quantity |
| Status    | SUCCESS, FAILED, or ERROR    |
| Message   | Result or error details      |

## How It Works

### 1. Inventory Edit

The `updateInventory()` function is triggered when a quantity is edited in column C of the `Inventory` sheet.

### 2. SKU Lookup

The application retrieves Shopify products and variants and creates a mapping between:

```text
SKU → Inventory Item ID
```

The mapping is cached using Google Apps Script Script Properties to reduce unnecessary Shopify API requests.

### 3. Location Lookup

The application retrieves Shopify locations and creates a mapping:

```text
Location Name → Location ID
```

### 4. Inventory Update

The Shopify inventory item and location are passed to the Shopify Inventory API.

The requested inventory quantity is then updated in Shopify.

### 5. Logging

The result is recorded in the `Sync_Log` sheet.

Possible statuses include:

```text
SUCCESS
FAILED
ERROR
```

## Configuration

Sensitive Shopify credentials are stored using Google Apps Script Script Properties.

Navigate to:

```text
Apps Script
→ Project Settings
→ Script Properties
```

Add the following properties:

```text
SHOPIFY_STORE
SHOPIFY_ACCESS_TOKEN
SHOPIFY_API_VERSION
```

Example:

```text
SHOPIFY_STORE = your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN = your_shopify_access_token
SHOPIFY_API_VERSION = your_api_version
```

Do not commit actual credentials to GitHub.

## Trigger Setup

The inventory synchronization function is designed to run using an installable edit trigger.

Configure the trigger as:

```text
Function:
updateInventory

Event source:
From spreadsheet

Event type:
On edit
```

## Utility Functions

### `testConnection()`

Tests connectivity with the Shopify Admin API.

### `findSku()`

Tests whether a particular SKU exists in the Shopify SKU mapping.

### `clearSkuCache()`

Clears the cached SKU mapping.

### `rebuildSkuCache()`

Clears the existing SKU cache and rebuilds it from Shopify.

### `createLogSheet()`

Creates the `Sync_Log` sheet if it does not already exist.

## Error Handling

The application handles common synchronization failures including:

* SKU not found
* Shopify location not found
* Shopify API errors
* Invalid inventory updates
* Failed synchronization requests

Errors are recorded in the `Sync_Log` sheet.

## Security

No Shopify credentials or access tokens are stored directly in the source code.

Sensitive configuration is stored using Google Apps Script Script Properties.

Never commit:

* Shopify access tokens
* API keys
* API secrets
* Database credentials
* Private business data
* Production spreadsheet IDs
* Customer information

## Project Use Case

This project demonstrates how Google Sheets can be used as an operational inventory interface while Shopify remains the source system for eCommerce inventory.

It is particularly useful for businesses that need a lightweight internal inventory management workflow without building a complete standalone inventory management application.

## Future Improvements

Potential improvements include:

* Bulk inventory synchronization
* Low-stock alerts
* Inventory history
* Scheduled synchronization
* Multiple spreadsheet support
* Inventory adjustment history
* Dashboard and reporting
* Shopify GraphQL API migration
* Retry handling for API failures
* Rate-limit handling
* Multi-location inventory management

## Author

Anjali Kapse

Shopify Developer | Frontend Developer

## License

This project is intended for portfolio and educational purposes.
