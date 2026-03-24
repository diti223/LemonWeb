Feature: Import Recipe to Lemon App

  Scenario: Open recipe link with Lemon installed
    Given a published recipe at recipes.lemonnutrition.eu/recipes/chili-con-carne-a3f8b2c1
    When the user taps the link on iOS with Lemon installed
    Then the app opens via universal link
    And the app fetches the .json endpoint (NOT HTML scrape)
    And the app shows the recipe review screen with image, ingredients, instructions

  Scenario: Open recipe link without Lemon installed
    Given a user on iOS without Lemon installed
    When the user taps "Open in Lemon" on the web page
    Then the browser navigates to the App Store listing for Lemon

  Scenario: FoodItem merge - matching UUID on device
    Given the device has FoodItem "Chicken Breast" with UUID X and custom nutrition
    And the imported recipe contains FoodItem with same UUID X
    When the user saves the imported recipe
    Then the ingredient uses the on-device FoodItem (preserving local nutrition)
    And the display name from the import is shown

  Scenario: FoodItem merge - new FoodItem
    Given the device does NOT have a FoodItem with UUID Y
    When the user imports a recipe containing FoodItem with UUID Y
    Then the FoodItem is imported as-is with all nutrition data

  Scenario: Fallback for non-Lemon URLs
    Given a recipe URL from allrecipes.com
    When the user imports it via the share extension
    Then the existing HTML scraper + AI flow is used (unchanged)
