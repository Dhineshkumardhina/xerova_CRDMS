class CRMSException(Exception):
    """Base exception class for CRMS application."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class EntityNotFoundException(CRMSException):
    """Exception raised when a requested resource is not found."""
    def __init__(self, entity_name: str, entity_id: str):
        super().__init__(f"{entity_name} with ID '{entity_id}' was not found.", status_code=404)

class DatabaseOperationException(CRMSException):
    """Exception raised when a database transaction encounters an operational error."""
    def __init__(self, message: str = "A database operation error occurred."):
        super().__init__(message, status_code=500)

class ValidationException(CRMSException):
    """Exception raised for invalid domain requests."""
    def __init__(self, message: str):
        super().__init__(message, status_code=422)
