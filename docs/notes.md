## Controllers (/controllers)
- Handles requests & responses but doesn’t contain business logic.
- Calls the appropriate service for processing.

## Services (/services)
- Contains core business logic.
- Doesn’t deal with HTTP requests/responses.
- Calls repositories for database interactions.

## Repositories (/repositories)
- Only database operations (No business logic).
- Abstracts away database queries.