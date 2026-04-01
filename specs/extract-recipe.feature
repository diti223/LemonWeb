Feature: Extract Recipe from URL

  Background:
    Given the EXTRACT_API_KEY is configured

  Scenario: Successfully extract a recipe via JSON-LD
    Given a recipe page that implements schema.org/Recipe JSON-LD
    When the app POSTs {"url":"https://example.com/recipe"} to /api/extract with a valid Bearer token
    Then the response status is 200
    And the response body contains title, ingredients, instructions, imageURL, and sourceURL

  Scenario: Extract rejected without authentication
    When the app POSTs to /api/extract without an Authorization header
    Then the response status is 401

  Scenario: Extract rejected with invalid URL
    When the app POSTs {"url":"not-a-url"} to /api/extract with a valid Bearer token
    Then the response status is 400
    And the error message is "Missing or invalid field: url"

  Scenario: Extract rejected with non-http URL
    When the app POSTs {"url":"file:///etc/passwd"} to /api/extract with a valid Bearer token
    Then the response status is 400
    And the error message is "Missing or invalid field: url"

  Scenario: Extract missing url field
    When the app POSTs {} to /api/extract with a valid Bearer token
    Then the response status is 400

  Scenario: Graceful empty result for unsupported page
    Given a page with no recipe markup or JSON-LD
    When the app POSTs the URL to /api/extract
    Then the response status is 200
    And ingredients and instructions are empty strings
    And imageURL is null
