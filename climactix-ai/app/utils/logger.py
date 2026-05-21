"""
Structured Logger — Climactix AI Core
Institutional-grade logging with file rotation and colorized console output.
"""

import sys
from loguru import logger

logger.remove()

# Console — INFO and above, colorized
logger.add(
    sys.stdout,
    format=(
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{line}</cyan> — "
        "<level>{message}</level>"
    ),
    level="INFO",
    colorize=True,
)

# File — DEBUG and above, rotated at 10 MB, retained 30 days
logger.add(
    "logs/climactix_ai.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{line} — {message}",
    level="DEBUG",
    rotation="10 MB",
    retention="30 days",
    compression="zip",
)

__all__ = ["logger"]
