Feature: Upload Recipe Image

  Scenario: Upload a hero image before publishing
    When the app POSTs an image to /api/images with slug "chili-con-carne-a3f8b2c1"
    Then the response status is 201
    And the response contains a public Vercel Blob URL
    And the URL is accessible without auth

  Scenario: Reject oversized image
    When the app POSTs a 10MB image to /api/images
    Then the response status is 413

  Scenario: Reject upload without auth
    When the app POSTs an image without an API key
    Then the response status is 401
