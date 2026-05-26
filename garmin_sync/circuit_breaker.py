import logging

logger = logging.getLogger(__name__)


class CircuitOpenError(Exception):
    pass


class CircuitBreaker:
    def __init__(self, max_failures: int = 3, reset_timeout: int = 60):
        self.max_failures = max_failures
        self.reset_timeout = reset_timeout
        self._failures = 0
        self._open = False

    def record_success(self) -> None:
        self._failures = 0
        self._open = False

    def record_failure(self) -> None:
        self._failures += 1
        if self._failures >= self.max_failures:
            self._open = True
            logger.error(
                "[CIRCUIT_OPEN] %d erreurs consécutives — arrêt", self._failures
            )

    def is_open(self) -> bool:
        return self._open

    def raise_if_open(self) -> None:
        if self._open:
            raise CircuitOpenError(
                f"Circuit ouvert après {self._failures} erreurs consécutives — "
                "les appels Garmin sont suspendus."
            )


garmin_circuit = CircuitBreaker(max_failures=3)
