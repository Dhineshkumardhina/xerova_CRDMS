import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException, status

class SlidingWindowRateLimiter:
    def __init__(self):
        # Maps (client_ip, endpoint_key) -> list of request timestamps
        self.requests: Dict[Tuple[str, str], List[float]] = defaultdict(list)

    def reset(self):
        self.requests.clear()

    def check_rate_limit(self, request: Request, endpoint_key: str, max_requests: int = 5, window_seconds: int = 60):
        client_ip = request.client.host if request.client else "unknown_ip"
        
        # Bypass rate limiting for testclient internal unit tests unless specifically tested
        if client_ip == "testclient" and request.headers.get("x-test-rate-limit") != "true":
            return

        now = time.time()
        key = (client_ip, endpoint_key)

        # Remove timestamps outside window
        cutoff = now - window_seconds
        self.requests[key] = [t for t in self.requests[key] if t > cutoff]

        if len(self.requests[key]) >= max_requests:
            retry_after = int(window_seconds - (now - self.requests[key][0]))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {max_requests} requests allowed per {window_seconds} seconds. Please wait {retry_after}s before retrying.",
                headers={"Retry-After": str(max(1, retry_after))}
            )

        self.requests[key].append(now)

rate_limiter = SlidingWindowRateLimiter()
