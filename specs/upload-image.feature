Feature: Upload Recipe Image

  Background:
    # PUBLISH_API_KEY authenticates the client.
    # slug policy is shared with recipe publishing.

  Scenario: Upload a hero image before publishing
    When the app POSTs an image to /api/images with slug "chili-con-carne-a3f8b2c1"
    Then the response status is 201
    And the response contains a public Vercel Blob URL
    And the URL is accessible without auth
    And the upload result can be reused during recipe publish without changing slug policy

  Scenario: Reject oversized image
    When the app POSTs a 10MB image to /api/images
    Then the response status is 413

  Scenario: Reject upload without auth
    When the app POSTs an image without an API key
    Then the response status is 401

  Scenario: Reject upload without slug
    When the app POSTs an image without the slug query parameter
    Then the response status is 400
