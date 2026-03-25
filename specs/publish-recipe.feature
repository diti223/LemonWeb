Feature: Publish Recipe

  Background:
    # PUBLISH_API_KEY authenticates Lemon clients.
    # authorId identifies the publishing owner.
    # A stored recipe keeps authorId private; the public JSON never exposes it.

  Scenario: User shares a recipe publicly from the app
    Given a recipe "Chili Con Carne" with id "a3f8b2c1-1234-5678-9abc-def012345678"
    And the recipe has ingredients with full FoodItem data
    And the user has authorId "abc123xyz789"
    And the user has uploaded a hero image via POST /api/images with recipeId "a3f8b2c1-1234-5678-9abc-def012345678"
    When the app POSTs the recipe JSON to /api/recipes with a valid API key
    Then the response status is 201
    And the response contains slug "chili-con-carne-a3f8b2c1"
    And the response contains the public URL
    And the recipe is viewable at /recipes/chili-con-carne-a3f8b2c1
    And the stored recipe keeps authorId "abc123xyz789"
    And the public JSON does not expose authorId

  Scenario: Publish rejected without auth
    When the app POSTs a recipe to /api/recipes without an API key
    Then the response status is 401

  Scenario: Publish rejected without author identity
    When the app POSTs a recipe without authorId
    Then the response status is 400
    And the response body describes the validation error

  Scenario: Publish rejected with invalid payload
    When the app POSTs JSON missing required field "title"
    Then the response status is 400
    And the response body describes the validation error

  Scenario: Author unpublishes their own recipe
    Given a published recipe with id "a3f8b2c1-1234-5678-9abc-def012345678" and authorId "abc123xyz789"
    When the app sends DELETE /api/recipes/a3f8b2c1-1234-5678-9abc-def012345678 with a valid API key and authorId "abc123xyz789"
    Then the response status is 204
    And the recipe page returns 404

  Scenario: Non-author cannot unpublish someone else's recipe
    Given a published recipe with id "a3f8b2c1-1234-5678-9abc-def012345678" and authorId "abc123xyz789"
    When the app sends DELETE /api/recipes/a3f8b2c1-1234-5678-9abc-def012345678 with a valid API key and authorId "different999"
    Then the response status is 403
    And the recipe remains published

  Scenario: Republishing updates an existing recipe by the same author
    Given a published recipe with id "a3f8b2c1-1234-5678-9abc-def012345678" and authorId "abc123xyz789"
    When the author POSTs the same recipe with updated title "Spicy Chili Con Carne"
    Then the response status is 201
    And the recipe page shows the updated title
    And the canonical slug policy is applied consistently
    And the previous slug is replaced by the new slug mapping

  Scenario: Non-author cannot overwrite another author's published recipe
    Given a published recipe with id "a3f8b2c1-1234-5678-9abc-def012345678" and authorId "abc123xyz789"
    When a different author POSTs the same recipe id
    Then the response status is 403
    And the original recipe remains published

  Scenario: A different author can republish only after unpublish
    Given a recipe with id "a3f8b2c1-1234-5678-9abc-def012345678" was published by authorId "abc123xyz789"
    And the recipe was unpublished
    When user with authorId "newuser456" publishes the same recipe id
    Then the response status is 201
    And the stored recipe keeps authorId "newuser456"
