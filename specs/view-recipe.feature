Feature: View Recipe on Web

  Scenario: Visitor views a published recipe
    Given a published recipe "Chili Con Carne" with image, 7 servings, 10 ingredients
    When a visitor opens /recipes/chili-con-carne-a3f8b2c1
    Then the page has a dark theme with black background
    And the page shows the hero image with rounded corners
    And the page shows the recipe title and description
    And the page shows servings count (static, no scaling)
    And the page shows total nutrition (calories, protein, fat, carbs)
    But the page does NOT show per-ingredient macros
    And the page shows the ingredient list as simple text
    And the page shows numbered instructions
    And the page shows notes if present
    And the page shows a yellow "Open in Lemon" CTA button

  Scenario: SEO and sharing metadata
    Given a published recipe with image
    Then the page has Open Graph title, description, and image
    And the page has Twitter Card metadata
    And the page has Recipe JSON-LD structured data
    And the page has a canonical URL

  Scenario: JSON endpoint returns full recipe data
    When a client fetches /recipes/chili-con-carne-a3f8b2c1.json
    Then the response is JSON with version "2.0"
    And ingredients contain full FoodItem objects with nutrition tables
    And ingredients contain structured Quantity with Unit encoding
    And the response does NOT expose authorId
    And the response does NOT expose page-only display fields
    And the same slug and canonical URL policy is used by API publish and CLI publish

  Scenario: Print mode
    When a visitor triggers print on the recipe page
    Then the printed page uses a light background
    And the CTA button is hidden
    And the layout is optimized for paper
