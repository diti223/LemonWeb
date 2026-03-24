Feature: Publish Recipe

  Scenario: User shares a recipe publicly from the app
    Given a recipe "Chili Con Carne" with id "a3f8b2c1-1234-5678-9abc-def012345678"
    And the recipe has ingredients with full FoodItem data
    And the user has uploaded a hero image via POST /api/images
    When the app POSTs the recipe JSON to /api/recipes with a valid API key
    Then the response status is 201
    And the response contains slug "chili-con-carne-a3f8b2c1"
    And the response contains the public URL
    And the recipe is viewable at /recipes/chili-con-carne-a3f8b2c1

  Scenario: Publish rejected without auth
    When the app POSTs a recipe to /api/recipes without an API key
    Then the response status is 401

  Scenario: Publish rejected with invalid payload
    When the app POSTs JSON missing required field "title"
    Then the response status is 400
    And the response body describes the validation error

  Scenario: User unpublishes a recipe
    Given a published recipe with id "a3f8b2c1-1234-5678-9abc-def012345678"
    When the app sends DELETE /api/recipes/a3f8b2c1-1234-5678-9abc-def012345678 with a valid API key
    Then the response status is 204
    And the recipe page returns 404

  Scenario: Republishing updates an existing recipe
    Given a published recipe with id "a3f8b2c1-1234-5678-9abc-def012345678"
    When the app POSTs the same recipe with updated title "Spicy Chili Con Carne"
    Then the response status is 201
    And the recipe page shows the updated title
    And the old slug redirects or is replaced
