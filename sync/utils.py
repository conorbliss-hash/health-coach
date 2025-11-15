import sys


def require(condition: bool, message: str) -> None:
    if condition:
        return
    print(f"[FATAL] {message}", file=sys.stderr)
    sys.exit(1)
