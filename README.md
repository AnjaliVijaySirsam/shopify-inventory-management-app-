# Shopify Inventory Management & Sync

A Google Apps Script–based inventory synchronization system that connects Google Sheets with the Shopify Admin API to automate inventory quantity updates.

The project uses Google Sheets as an inventory interface and synchronizes edited quantities with Shopify using SKU mapping, location mapping, input validation, caching, and synchronization logs.

## Overview

Manually updating inventory in an e-commerce store can be repetitive and error-prone. This project demonstrates how Google Apps Script can automate inventory updates between Google Sheets and Shopify.

When a relevant inventory edit is made in the `Inventory` sheet, the script identifies the corresponding Shopify inventory item and location, submits the requested quantity through the Shopify Admin API, and records the result in `Sync_Log`.

## Features

- Automated inventory updates triggered by spreadsheet edits
- SKU-based inventory item identification
- Shopify inventory location mapping
- SKU mapping cached using Google Apps Script Script Properties
- SKU cache refresh when a SKU is not found
- Shopify product pagination handling
- Validation of required SKU and location fields
- Validation of non-negative integer inventory quantities
- Synchronization success and failure logging
- Shopify API connection testing
- SKU lookup utility
- SKU cache clearing and rebuilding utilities
- Automatic creation of the `Sync_Log` sheet when required
- Support for single-cell and multi-row edits involving column C
- Credential configuration through Script Properties

## Technology Stack

- **Google Apps Script** — automation and integration logic
- **Google Sheets** — inventory input and synchronization logs
- **JavaScript** — application logic
- **Shopify Admin REST API** — product, location, and inventory operations
- **Google Apps Script Properties Service** — configuration and SKU cache storage

## Architecture

```text
Google Sheets — Inventory
          |
          | Relevant inventory edit
          v
Google Apps Script
          |
          | Validate SKU, location, and quantity
          v
SKU Mapping & Location Lookup
          |
          | Resolve inventory item and location IDs
          v
Shopify Admin REST API
          |
          | Submit inventory quantity update
          v
Shopify Inventory
          |
          v
Google Sheets — Sync_Log
```

## Google Sheets Structure

### 1. Inventory Sheet

The `Inventory` sheet contains the inventory data used by the synchronization workflow.

https://github.com/AnjaliVijaySirsam/shopify-inventory-management-app-/blob/main/Screenshots/inventory-sheet.png


Example:

| SKU | Location | Available |
|---|---|---:|
| PRODUCT-SKU-001 | Main Warehouse | 25 |
| PRODUCT-SKU-002 | Main Warehouse | 10 |

**Requirements:**
- Use SKUs that match product variants in Shopify.
- Use location names that match Shopify inventory locations.
- Enter inventory quantities as non-negative whole numbers.
- The script skips rows with blank quantities.

### 2. Sync_Log Sheet

The `Sync_Log` sheet records synchronization results.

https://github.com/AnjaliVijaySirsam/shopify-inventory-management-app-/blob/main/Screenshots/sync-log.png

The log helps identify successful updates and troubleshoot synchronization failures.

### 3. Shopify Inventory Verification

Shows the updated inventory quantity verified in Shopify Admin.

https://github.com/AnjaliVijaySirsam/shopify-inventory-management-app-/blob/main/Screenshots/shopify-inventory-verification.png

## How It Works

### 1. Inventory Edit Trigger

The `updateInventory(e)` function is designed to run through an installable spreadsheet **On edit** trigger.

It processes relevant edits on the `Inventory` sheet when the edited range includes column C. It supports single-cell edits and multi-row edits involving that column.

### 2. Input Validation

Before submitting an inventory update, the script checks that:

- The SKU is present.
- The location is present.
- The quantity is a non-negative integer.

Rows with invalid required fields or quantities are logged as failures and are not submitted as inventory updates.

Blank quantity cells are skipped.

### 3. SKU Lookup and Caching

The `getSkuMap()` function retrieves Shopify product and variant information and builds a mapping between SKUs and inventory item IDs.

```text
SKU → Inventory Item ID
```

The mapping is cached in Google Apps Script Script Properties to reduce repeated product retrieval requests.

If an SKU is not found in the cached mapping, the script clears the cache and attempts to rebuild it before reporting that the SKU was not found.

### 4. Location Lookup

The `getLocationMap()` function retrieves Shopify inventory locations and creates a mapping between location names and location IDs.

```text
Location Name → Location ID
```

The script uses the resolved location ID when submitting the inventory update.

### 5. Inventory Update

The `setInventoryLevel()` function submits the requested available quantity for the matching inventory item and location through the Shopify Admin REST API.

The function checks the HTTP response status and reports an error if the update request does not return HTTP 200.

### 6. Synchronization Logging

The `logSync()` function records the timestamp, SKU, location, requested quantity, status, and message in `Sync_Log`.

The script records outcomes according to its implemented validation and error-handling logic.

## Configuration

Shopify configuration values are stored in Google Apps Script **Script Properties** rather than hardcoded in the source code.

### Required Script Properties

Navigate to:

`Apps Script → Project Settings → Script Properties`

Configure the following properties:

| Property | Description |
|---|---|
| `SHOPIFY_STORE` | Your Shopify store domain |
| `SHOPIFY_ACCESS_TOKEN` | Your Shopify Admin API access token |
| `SHOPIFY_API_VERSION` | The Shopify API version configured for the script |

Example values:

```text
SHOPIFY_STORE = your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN = your_private_access_token
SHOPIFY_API_VERSION = your_api_version
```

These are placeholders, not actual credentials.

The script checks that all three properties are present and validates the store domain format before using the configuration.

**Important:** Use a Shopify API version supported by Shopify. The API version must be compatible with the endpoints and request formats used by the script.

## Trigger Setup

Configure an installable trigger in Google Apps Script.

| Setting | Value |
|---|---|
| Function to run | `updateInventory` |
| Event source | From spreadsheet |
| Event type | On edit |

Ensure that only one intended trigger is configured for `updateInventory` to avoid duplicate executions.

The script responds to user edits that trigger the spreadsheet event. Script-generated changes do not independently trigger an installable edit event.

## Utility Functions

The project includes the following utility functions:

| Function | Purpose |
|---|---|
| `testConnection()` | Tests connectivity with the Shopify Admin API using the configured credentials |
| `findSku()` | Checks whether a predefined test SKU exists in the SKU mapping |
| `clearSkuCache()` | Deletes the cached `SKU_MAP` property |
| `rebuildSkuCache()` | Clears and rebuilds the SKU mapping from Shopify |
| `createLogSheet()` | Creates the `Sync_Log` sheet if it does not exist |
| `getShopifyConfig()` | Reads and validates the required Script Properties |

The `findSku()` utility currently uses a predefined SKU in the source code. Update that value if you want to test a different SKU.

## Error Handling

The script handles several common synchronization failures, including:

- Missing SKU
- Missing location
- SKU not found in the mapping
- Shopify location not found
- Invalid inventory quantity
- Location lookup failures
- Inventory update request failures

The script records relevant failures in `Sync_Log` according to the implemented error-handling logic.

**Current limitation:** SKU retrieval does not yet perform the same explicit HTTP response validation used by the location lookup and inventory update functions. More comprehensive API response validation is a potential future improvement.

## Testing and Verification

The following behaviors have been verified during development:

- Successful connection to the Shopify Admin API
- Inventory quantity updates initiated from Google Sheets
- Updated inventory quantity verified in Shopify Admin
- Synchronization results recorded in `Sync_Log`

Further edge-case testing can cover:

- Invalid SKUs
- Invalid locations
- Zero inventory quantities
- Negative and decimal quantities
- Multi-row edits
- Duplicate SKUs across different locations
- Shopify API errors and rate limits

Testing should use a suitable test product or safely restorable inventory quantities before applying changes to production inventory.

## Security

The project uses Google Apps Script Script Properties to store Shopify configuration values outside the source code.

Security recommendations:

- Never commit real Shopify access tokens or API secrets to GitHub.
- Do not publish private business data, customer information, or production spreadsheet IDs.
- Restrict access to the Apps Script project because project editors may be able to access its configuration.
- Rotate credentials if they are exposed.
- Review screenshots and logs before publishing them publicly.

Script Properties reduce the risk of accidentally committing credentials in source code, but they should not be treated as a dedicated secrets vault.

## Project Use Case

This project demonstrates how Google Sheets can serve as an operational inventory interface while Shopify remains the e-commerce inventory platform.

It is suitable as a portfolio demonstration of a lightweight inventory automation workflow without building a separate inventory management application.

The project showcases practical experience with:

- E-commerce API integration
- Google Apps Script automation
- Inventory data validation
- SKU and location mapping
- Caching and pagination
- Error handling and operational logging

## Future Improvements

Potential enhancements include:

- Bulk inventory synchronization
- Low-stock notifications
- Inventory change history and auditing
- Scheduled inventory reconciliation
- Support for multiple spreadsheets
- Inventory dashboards and reporting
- Migration to the Shopify GraphQL Admin API
- More comprehensive API response validation
- Retry handling for transient API failures
- Improved rate-limit handling
- Expanded automated edge-case testing

These are potential improvements and are not represented as completed features.

## Author

**Anjali Kapse**

Shopify Developer | Frontend Developer

GitHub: [AnjaliVijaySirsam](https://github.com/AnjaliVijaySirsam)

## License

This project is intended for portfolio and educational purposes. No formal open-source license is currently specified.
